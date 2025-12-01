// Load a Project from v1 app state

import * as l from '@openfn/lexicon';
import { Provisioner } from '@openfn/lexicon/lightning';

import { Project } from '../Project';
import renameKeys from '../util/rename-keys';
import slugify from '../util/slugify';
import ensureJson from '../util/ensure-json';

export type fromAppStateConfig = Partial<l.WorkspaceConfig> & {
  format?: 'yaml' | 'json';
};

export default (
  state: Provisioner.Project | string,
  meta: Partial<l.ProjectMeta> = {},
  config: fromAppStateConfig = {}
) => {
  let stateJson = ensureJson<Provisioner.Project>(state);
  delete config.format;

  const {
    id,
    name,
    description,
    workflows,
    project_credentials: credentials,
    collections,
    inserted_at,
    updated_at,
    ...options
  } = stateJson;

  const proj: Partial<l.Project> = {
    name,
    description: description ?? undefined,
    collections,
    credentials,
    options,
    config: config as l.WorkspaceConfig,
  };

  const { id: _ignore, ...restMeta } = meta;
  proj.openfn = {
    // @ts-ignore
    uuid: id,
    ...restMeta,

    inserted_at,
    updated_at,
  };

  // TODO maybe this for local metadata, stuff that isn't synced?
  // proj.meta = {
  //   fetched_at: config.fetchedAt,
  // };

  proj.workflows = stateJson.workflows.map(mapWorkflow);

  return new Project(proj as l.Project, config);
};

const mapTriggerEdgeCondition = (edge: Provisioner.Edge) => {
  const e: any = {
    disabled: !edge.enabled,
  };
  if (edge.condition_type === 'always') {
    e.condition = true;
  } else if (edge.condition_type === 'never') {
    e.condition = false;
  } else {
    e.condition = edge.condition_expression;
  }

  // Do this last so that it serializes last
  e.openfn = {
    uuid: edge.id,
  };
  return e;
};

// map a project workflow to a local cli workflow
// TODO this probably gets easier if I index everything by name
export const mapWorkflow = (workflow: Provisioner.Workflow) => {
  const { jobs, edges, triggers, name, ...remoteProps } = workflow;
  const mapped: l.Workflow = {
    name: workflow.name,
    steps: [],
    history: workflow.version_history ?? [],
    openfn: renameKeys(remoteProps, { id: 'uuid' }),
  };
  if (workflow.name) {
    mapped.id = slugify(workflow.name);
  }

  // TODO what do we do if the condition is disabled?
  // I don't think that's the same as edge condition false?
  workflow.triggers.forEach((trigger: Provisioner.Trigger) => {
    const { type, ...otherProps } = trigger;

    const connectedEdges = edges.filter(
      (e) => e.source_trigger_id === trigger.id
    );
    mapped.steps.push({
      id: 'trigger',
      type,
      openfn: renameKeys(otherProps, { id: 'uuid' }),
      next: connectedEdges.reduce((obj: any, edge) => {
        const target = jobs.find((j) => j.id === edge.target_job_id);
        if (!target) {
          throw new Error(`Failed to find ${edge.target_job_id}`);
        }
        // we use the name, not the id, to reference
        obj[slugify(target.name)] = mapTriggerEdgeCondition(edge);
        return obj;
      }, {}),
    } as l.Trigger);
  });

  workflow.jobs.forEach((step: Provisioner.Job) => {
    const outboundEdges = edges.filter(
      (e) => e.source_job_id === step.id || e.source_trigger_id === step.id
    );

    const { body: expression, name, adaptor, ...remoteProps } = step;

    const s: any /*l.Job*/ = {
      id: slugify(name),
      name: name,
      expression,
      adaptor, // TODO is this wrong?
      openfn: renameKeys(remoteProps, { id: 'uuid' }),
    };

    if (outboundEdges.length) {
      s.next = outboundEdges.reduce((next, edge) => {
        const target = jobs.find((j) => j.id === edge.target_job_id);
        // @ts-ignore
        next[slugify(target.name)] = mapTriggerEdgeCondition(edge);
        return next;
      }, {});
    }
    mapped.steps.push(s);
  });

  return mapped;
};
