import { pick, omitBy, isNil } from 'lodash-es';
import type l from '@openfn/lexicon';
import { Provisioner } from '@openfn/lexicon/lightning';
import { randomUUID } from 'node:crypto';

import { Project } from '../Project';
import renameKeys from '../util/rename-keys';
import { jsonToYaml } from '../util/yaml';
import Workflow from '../Workflow';

type Options = { format?: 'json' | 'yaml' };

// TODO this should allow override on format,
// regardless of repo settings
export default function (
  project: Project,
  options: Options = {}
): Provisioner.Project | string {
  const { uuid, endpoint, env, ...rest } = project.openfn ?? {};

  const state = omitBy(
    pick(project, ['name', 'description', 'collections']),
    isNil
  ) as Provisioner.Project;

  state.id = uuid!;

  Object.assign(state, rest, project.options);
  state.project_credentials = project.credentials ?? [];
  state.workflows = project.workflows.map(mapWorkflow);

  const shouldReturnYaml =
    options.format === 'yaml' ||
    (!options.format && project.config.formats.project === 'yaml');

  if (shouldReturnYaml) {
    return jsonToYaml(state);
  }

  return state;
}

const mapWorkflow = (workflow: Workflow) => {
  if (workflow instanceof Workflow) {
    workflow = workflow.toJSON();
  }

  const { uuid, ...originalOpenfnProps } = workflow.openfn ?? {};
  const wfState = {
    ...originalOpenfnProps,
    id: workflow.openfn?.uuid ?? randomUUID(),
    jobs: [],
    triggers: [],
    edges: [],
    lock_version: workflow.openfn?.lock_version ?? null, // TODO needs testing
  } as unknown as Provisioner.Workflow;

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

  workflow.steps.forEach((s: any) => {
    let isTrigger = false;
    let node: Provisioner.Job | Provisioner.Trigger;

    if (s.type && !s.expression) {
      isTrigger = true;
      node = {
        type: s.type,
        ...renameKeys(s.openfn, { uuid: 'id' }),
      } as Provisioner.Trigger;
      wfState.triggers.push(node);
    } else {
      node = omitBy(pick(s, ['name', 'adaptor']), isNil) as Provisioner.Job;
      const { uuid, ...otherOpenFnProps } = s.openfn ?? {};
      node.id = uuid;
      Object.assign(node, otherOpenFnProps);
      if (s.expression) {
        node.body = s.expression;
      }
      node.project_credential_id = s.openfn?.project_credential_id ?? null;
      // TODO need to track this
      node.keychain_credential_id = null;

      wfState.jobs.push(node);
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

      if (rules.condition === true) {
        e.condition_type = 'always';
      } else if (rules.condition === false) {
        e.condition_type = 'never';
      } else if (typeof rules.condition === 'string') {
        // TODO conditional
      }
      wfState.edges.push(e);
    });
  });

  return wfState;
};
