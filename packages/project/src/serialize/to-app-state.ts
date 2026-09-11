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
    pick(project, ['name', 'description', 'channels']),
    isNil
  ) as Provisioner.Project;

  state.id = (uuid as string) ?? randomUUID();

  // unlike ProjectState, Provisioner.Project.collections is a required
  // field on the wire - always send it, defaulting to []
  state.collections = (project.collections ?? []).map((c) => ({
    // mint an id for any collection that doesn't have one yet (ie, was
    // authored locally in openfn.yaml, never fetched from the server)
    id: c.uuid ?? randomUUID(),
    name: c.name,
  }));

  // Ensure each credential has a UUID
  project.credentials =
    project.credentials?.map((c) => ({
      ...c,
      uuid: c.uuid ?? randomUUID(),
    })) ?? [];

  Object.assign(state, rest, project.options);
  state.project_credentials = project.credentials.map((c) => ({
    // note the subtle conversion here: uuid -> id
    // That's because the local Project uses the uuid key to track UUIDs
    // but the provisioner spec uses id
    id: c.uuid as string,
    name: c.name,
    owner: c.owner,
  }));

  state.workflows = project.workflows
    .map((w) => mapWorkflow(w, project.credentials))
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
  credentials: CredentialState[] = []
) => {
  // captured before toJSON(), since the `lookup` build below mints fresh uuids for anything missing one
  const removed =
    workflow instanceof Workflow
      ? workflow.removed
      : { self: false, ids: {} as Record<string, boolean> };
  const originalUuids: Record<string, string> =
    workflow instanceof Workflow ? workflow.getUUIDMap() : {};

  if (workflow instanceof Workflow) {
    // @ts-ignore
    workflow = workflow.toJSON();
  }

  const { uuid, ...originalOpenfnProps } = workflow.openfn ?? {};

  if (removed.self && uuid) {
    // nothing else about a deleted workflow matters to the provisioner
    return {
      ...originalOpenfnProps,
      id: uuid,
      name: workflow.name,
      delete: true,
      jobs: {},
      triggers: {},
      edges: {},
      lock_version: workflow.openfn?.lock_version ?? null,
    } as Provisioner.Workflow;
  }

  const wfState = {
    ...originalOpenfnProps,
    jobs: {},
    triggers: {},
    edges: {},
    lock_version: workflow.openfn?.lock_version ?? null, // TODO needs testing
  } as Provisioner.Workflow;

  wfState.id = (workflow.openfn?.uuid ?? randomUUID()) as any;

  if (workflow.name) {
    wfState.name = workflow.name;
  }

  // lookup of local-ids to project-ids
  const lookup = workflow.steps.reduce((obj, next) => {
    if (!next.openfn?.uuid) {
      // If there's no tracked id, we generate one here
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

    const isRemoved = !!removed.ids[s.id];
    const nodeUuid = originalUuids[s.id];

    if (isRemoved && !nodeUuid) {
      // never synced to Lightning - nothing to delete server-side
      return;
    }

    if (s.type) {
      isTrigger = true;

      if (isRemoved) {
        node = { id: nodeUuid, delete: true } as Provisioner.Trigger;
      } else {
        const { type, id, next, openfn, ...rest } = s;
        node = {
          ...rest,
          type: s.type ?? 'webhook', // this is mostly for tests
          ...renameKeys(openfn, { uuid: 'id' }),
        } as Provisioner.Trigger;
      }
      wfState.triggers[s.type] = node;
    } else {
      if (isRemoved) {
        node = { id: nodeUuid, delete: true } as Provisioner.Job;
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
            if (mappedCredential) {
              projectCredentialId = mappedCredential.uuid;
            }

            otherOpenFnProps.project_credential_id = projectCredentialId;
          }
        }

        Object.assign(node, defaultJobProps, otherOpenFnProps);
      }

      wfState.jobs[s.id ?? slugify(s.name)] = node;
    }

    if (isRemoved) {
      // a removed step's edges are meaningless without also being removed via workflow.remove(from, to)
      return;
    }

    // create an edge to each linked node
    Object.keys(s.next ?? {}).forEach((next) => {
      const rules = s.next[next];

      const edgeIsRemoved = !!removed.ids[`${s.id}-${next}`];
      const edgeUuid = originalUuids[`${s.id}-${next}`];

      if (edgeIsRemoved && !edgeUuid) {
        return;
      }

      if (edgeIsRemoved) {
        wfState.edges[`${s.id}->${next}`] = {
          id: edgeUuid,
          delete: true,
        } as any;
        return;
      }

      const { uuid, ...otherOpenFnProps } = rules.openfn ?? {};

      const e: any = {
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
