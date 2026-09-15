// Serialize a Project into the v1 SPEC format, as exported by the Lightning app
//
// Unlike v1 state (see to-app-state), a spec carries no uuids: workflows, jobs,
// triggers and credentials are all cross-referenced by their key in the owning
// map. parse/from-app-spec is the inverse

import { pick, omitBy, isNil, sortBy } from 'lodash-es';
import { Provisioner } from '@openfn/lexicon/lightning';
import { randomUUID } from 'node:crypto';

import { Project } from '../Project';
import { jsonToYaml } from '../util/yaml';
import Workflow from '../Workflow';
import slugify from '../util/slugify';
import getCredentialName from '../util/get-credential-name';

type Options = {
  format?: 'json' | 'yaml';
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
    id: c.uuid ?? randomUUID(),
    name: c.name,
  }));

  Object.assign(state, rest, project.options);

  // a spec names its credentials rather than referencing them by uuid
  for (const c of project.credentials ?? []) {
    (state as any).credentials ??= {};
    (state as any).credentials[getCredentialName(c)] = {
      name: c.name,
      owner: c.owner,
    };
  }

  state.workflows = project.workflows
    .map((w) => mapWorkflow(w))
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

export const mapWorkflow = (workflow: Workflow) => {
  if (workflow instanceof Workflow) {
    // @ts-ignore
    workflow = workflow.toJSON();
  }

  const { uuid, ...originalOpenfnProps } = (workflow as any).openfn ?? {};

  const wfState = {
    ...originalOpenfnProps,
    jobs: {},
    triggers: {},
    edges: {},
    lock_version: (workflow as any).openfn?.lock_version ?? null,
  } as Provisioner.Workflow;

  if (workflow.name) {
    wfState.name = workflow.name;
  }

  // Sort steps by name (for more predictable comparisons in test)
  sortBy((workflow as any).steps, 'name').forEach((s: any) => {
    let isTrigger = false;
    let node: Provisioner.Job | Provisioner.Trigger;

    if (s.type) {
      isTrigger = true;
      const { type, id, next, openfn, ...restStep } = s;
      node = {
        ...restStep,
        type: s.type ?? 'webhook', // this is mostly for tests
      } as Provisioner.Trigger;
      wfState.triggers[s.type] = node;
    } else {
      node = omitBy(pick(s, ['name', 'adaptor']), isNil) as Provisioner.Job;
      const { uuid: _uuid, ...otherOpenFnProps } = s.openfn ?? {};
      if (s.expression) {
        node.body = s.expression;
      }
      if (
        typeof s.configuration === 'string' &&
        !s.configuration.endsWith('.json') &&
        s.configuration
      ) {
        // a spec refers to a credential by name, exactly as authored
        otherOpenFnProps.credential = s.configuration;
      }

      Object.assign(node, otherOpenFnProps);
      wfState.jobs[s.id ?? slugify(s.name)] = node;
    }

    // edges name their source and target steps by key
    Object.keys(s.next ?? {}).forEach((next) => {
      const rules = s.next[next];
      const { uuid: _uuid, ...otherOpenFnProps } = rules.openfn ?? {};

      const e: any = {
        enabled: !rules.disabled,
        target_job: next,
      };
      Object.assign(e, otherOpenFnProps);
      if (isTrigger) {
        e.source_trigger = s.type;
      } else {
        e.source_job = s.id;
      }

      if (rules.label) {
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

  return wfState;
};
