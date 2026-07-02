import { pick, omitBy, isNil, sortBy } from 'lodash-es';
import { CredentialState } from '@openfn/lexicon';
import { Provisioner } from '@openfn/lexicon/lightning';
import { randomUUID } from 'node:crypto';

import { Project } from '../Project';
import renameKeys from '../util/rename-keys';
import { jsonToYaml } from '../util/yaml';
import Workflow from '../Workflow';
import slugify from '../util/slugify';
import getCredentialName from '../util/get-credential-name';

type Options = {
  format?: 'json' | 'yaml';
  /**
   * Serialize the project into a v1 spec format (not state)
   * This is awkward and ugly but should only be a temporary solution
   * If we decide we need it long term, we should generate a separate
   * to-app-spec function which does a more focused job of it.
   */
  asSpec?: boolean;
};

const defaultJobProps = {
  // TODO why does the provisioner throw if these keys are not set?
  // Ok, 90% of jobs will have a credential, but it's still optional right?
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
    alias, // shouldn't be written but has been caught in some legacy files
    ...rest
  } = project.openfn ?? {};

  const state = omitBy(
    pick(project, ['name', 'description', 'collections', 'channels']),
    isNil
  ) as Provisioner.Project;

  state.id = (uuid as string) ?? randomUUID();

  Object.assign(state, rest, project.options);
  if (options.asSpec) {
    for (const c of project.credentials) {
      // note that credentials for a spec file are not the
      // the same format as a state file,
      // so typings break here
      (state as any).credentials ??= {};
      (state as any).credentials[getCredentialName(c)] = {
        name: c.name,
        owner: c.owner,
      };
    }
  } else {
    const credentialsWithUuids =
      project.credentials?.map((c) => ({
        ...c,
        uuid: (c as CredentialState).uuid ?? randomUUID(),
      })) ?? [];

    state.project_credentials = credentialsWithUuids.map((c) => ({
      // note the subtle conversion here
      id: c.uuid as string,
      name: c.name,
      owner: c.owner,
    }));
  }

  state.workflows = project.workflows
    .map((w) => mapWorkflow(w, project.credentials, options))
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
  credentials: CredentialState[] = [],
  options: Options = {}
) => {
  const useUuids = !options.asSpec;

  if (workflow instanceof Workflow) {
    // @ts-ignore
    workflow = workflow.toJSON();
  }

  const { uuid, ...originalOpenfnProps } = workflow.openfn ?? {};
  const wfState = {
    ...originalOpenfnProps,
    jobs: {},
    triggers: {},
    edges: {},
    lock_version: workflow.openfn?.lock_version ?? null, // TODO needs testing
  } as Provisioner.Workflow;

  if (useUuids) {
    wfState.id = (workflow.openfn?.uuid ?? randomUUID) as any;
  }

  if (workflow.name) {
    wfState.name = workflow.name;
  }

  // lookup of local-ids to project-ids (only needed when using UUIDs)
  const lookup = workflow.steps.reduce((obj, next) => {
    if (useUuids) {
      if (!next.openfn?.uuid) {
        // If there's no tracked id, we generate one here
        next.openfn ??= {};
        next.openfn.uuid = randomUUID();
      }
      // @ts-ignore
      obj[next.id] = next.openfn.uuid;
    }
    return obj;
  }, {}) as Record<string, string>;

  // Sort steps by name (for more predictable comparisons in test)
  sortBy(workflow.steps, 'name').forEach((s: any) => {
    let isTrigger = false;
    let node: Provisioner.Job | Provisioner.Trigger;

    if (s.type) {
      isTrigger = true;

      const { type, id, next, openfn, ...rest } = s;
      node = {
        ...rest,
        type: s.type ?? 'webhook', // this is mostly for tests
        ...(useUuids ? renameKeys(openfn, { uuid: 'id' }) : {}),
      } as Provisioner.Trigger;
      wfState.triggers[node.type] = node;
    } else {
      node = omitBy(pick(s, ['name', 'adaptor']), isNil) as Provisioner.Job;
      const { uuid, ...otherOpenFnProps } = s.openfn ?? {};
      if (useUuids) {
        node.id = uuid;
      }
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
          if (mappedCredential && useUuids) {
            projectCredentialId = mappedCredential.uuid;
          }

          if (useUuids) {
            otherOpenFnProps.project_credential_id = projectCredentialId;
          } else {
            otherOpenFnProps.credential = projectCredentialId;
          }
        }
      }

      Object.assign(node, useUuids ? defaultJobProps : {}, otherOpenFnProps);

      wfState.jobs[s.id ?? slugify(s.name)] = node;
    }

    // create an edge to each linked node
    Object.keys(s.next ?? {}).forEach((next) => {
      const rules = s.next[next];

      const { uuid, ...otherOpenFnProps } = rules.openfn ?? {};

      let e: any;
      if (useUuids) {
        e = {
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
      } else {
        e = {
          enabled: !rules.disabled,
          target_job: next,
        };
        Object.assign(e, otherOpenFnProps);
        if (isTrigger) {
          e.source_trigger = s.type;
        } else {
          e.source_job = s.id;
        }
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

  if (useUuids) {
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
  }

  return wfState;
};
