import { pick, omitBy, isNil, sortBy } from 'lodash-es';
import { Provisioner } from '@openfn/lexicon/lightning';
import { randomUUID } from 'node:crypto';

import { Credential, Project } from '../Project';
import renameKeys from '../util/rename-keys';
import { jsonToYaml } from '../util/yaml';
import Workflow from '../Workflow';
import slugify from '../util/slugify';
import getCredentialName from '../util/get-credential-name';

type Options = { format?: 'json' | 'yaml' };

const defaultJobProps = {
  // TODO why does the provisioner throw if these keys are not set?
  // Ok, 90% of jobs will have a credenial, but it's still optional right?
  keychain_credential_id: null,
  project_credential_id: null,
};

export default function (
  project: Project,
  options: Options = {}
): Provisioner.Project | string {
  const {
    uuid,
    endpoint,
    env,
    id /* shouldn't be there but will cause problems if it's set*/,
    fetched_at /* remove this metadata as it causes problems */,
    ...rest
  } = project.openfn ?? {};

  const state = omitBy(
    pick(project, ['name', 'description', 'collections']),
    isNil
  ) as Provisioner.Project;

  state.id = (uuid as string) ?? randomUUID();

  Object.assign(state, rest, project.options);

  const credentialsWithUuids =
    project.credentials?.map((c) => ({
      ...c,
      uuid: c.uuid ?? randomUUID(),
    })) ?? [];

  state.project_credentials = credentialsWithUuids.map((c) => ({
    // note the subtle conversion here
    id: c.uuid,
    name: c.name,
    owner: c.owner,
  }));

  state.workflows = project.workflows
    .map((w) => mapWorkflow(w, credentialsWithUuids))
    .reduce((obj: any, wf) => {
      obj[slugify(wf.name ?? wf.id)] = wf;
      return obj;
    }, {});

  const shouldReturnYaml =
    options.format === 'yaml' ||
    (!options.format && project.config.formats.project === 'yaml');

  if (shouldReturnYaml) {
    return jsonToYaml(state);
  }

  return state;
}

export const mapWorkflow = (
  workflow: Workflow,
  credentials: Credential[] = []
) => {
  if (workflow instanceof Workflow) {
    // @ts-ignore
    workflow = workflow.toJSON();
  }

  const { uuid, ...originalOpenfnProps } = workflow.openfn ?? {};
  const wfState = {
    ...originalOpenfnProps,
    id: workflow.openfn?.uuid ?? randomUUID(),
    jobs: {},
    triggers: {},
    edges: {},
    lock_version: workflow.openfn?.lock_version ?? null, // TODO needs testing
  } as Provisioner.Workflow;

  if (workflow.name) {
    wfState.name = workflow.name;
  }

  // lookup of local-ids to project-ids
  const lookup = workflow.steps.reduce((obj, next) => {
    if (!next.openfn?.uuid) {
      // If there's no tracked id, we generate one here
      // TODO there is no unit test on this
      next.openfn ??= {};
      next.openfn.uuid = randomUUID();
    }

    // @ts-ignore
    obj[next.id] = next.openfn.uuid;
    return obj;
  }, {}) as Record<string, string>;

  // Sort steps by name (for more predictable comparisons in test)
  sortBy(workflow.steps, 'name').forEach((s: any) => {
    let isTrigger = false;
    let node: Provisioner.Job | Provisioner.Trigger;

    if (s.type) {
      isTrigger = true;
      node = {
        type: s.type ?? 'webhook', // this is mostly for tests
        enabled: s.enabled,
        ...renameKeys(s.openfn, { uuid: 'id' }),
      } as Provisioner.Trigger;
      wfState.triggers[node.type] = node;
    } else {
      node = omitBy(pick(s, ['name', 'adaptor']), isNil) as Provisioner.Job;
      const { uuid, ...otherOpenFnProps } = s.openfn ?? {};
      node.id = uuid;
      if (s.expression) {
        node.body = s.expression;
      }
      if (
        typeof s.configuration === 'string' &&
        !s.configuration.endsWith('.json')
      ) {
        let projectCredentialId = s.configuration;
        if (projectCredentialId) {
          const mappedCredential = credentials.find((c) => {
            const name = getCredentialName(c);
            return name === projectCredentialId;
          });
          // TODO what if the credential isn't mapped?
          // Will deploy break?
          // Do we have to warn the user?
          if (mappedCredential) {
            projectCredentialId = mappedCredential.uuid;
          }
          otherOpenFnProps.project_credential_id = projectCredentialId;
        }
      }

      Object.assign(node, defaultJobProps, otherOpenFnProps);

      wfState.jobs[s.id ?? slugify(s.name)] = node;
    }

    // create an edge to each linked node
    Object.keys(s.next ?? {}).forEach((next) => {
      const rules = s.next[next];

      const { uuid, ...otherOpenFnProps } = rules.openfn ?? {};

      const e = {
        id: uuid ?? randomUUID(),
        target_job_id: lookup[next],
        enabled: !rules.disabled,
        source_trigger_id: null, // lightning complains if this isn't set, even if its falsy :(
      } as Provisioner.Edge;
      Object.assign(e, otherOpenFnProps);

      if (isTrigger) {
        e.source_trigger_id = node.id;
      } else {
        e.source_job_id = node.id;
      }

      if (rules.label) {
        // TODO needs unit test
        e.condition_label = rules.label;
      }

      if (rules.condition) {
        if (typeof rules.condition === 'boolean') {
          e.condition_type = rules.condition ? 'always' : 'never';
        } else if (
          rules.condition.match(
            /^(always|never|on_job_success|on_job_failure)$/
          )
        ) {
          e.condition_type = rules.condition;
        } else {
          e.condition_type = 'js_expression';
          e.condition_expression = rules.condition;
        }
      }
      wfState.edges[`${s.id}->${next}`] = e;
    });
  });

  // Sort edges by UUID (for more predictable comparisons in test)
  wfState.edges = Object.keys(wfState.edges)
    // convert edge ids to strings just in case a number creeps in (it might in test)
    .sort((a, b) =>
      `${wfState.edges[a].id}`.localeCompare('' + wfState.edges[b].id)
    )
    .reduce((obj: any, key) => {
      obj[key] = wfState.edges[key];
      return obj;
    }, {});

  return wfState;
};
