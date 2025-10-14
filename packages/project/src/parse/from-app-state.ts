// Load a Project from app state

import * as l from '@openfn/lexicon';
import { Provisioner } from '@openfn/lexicon/lightning';
import { OpenfnConfig, Project } from '../Project';
import { yamlToJson } from '../util/yaml';
import renameKeys from '../util/rename-keys';

// Extra metadata used to init the project
type FromAppStateConfig = {
  endpoint: string;
  env?: string;
  fetchedAt?: string;
  format?: 'json' | 'yaml';

  // Allow workspace config to be passed
  repo: OpenfnConfig;
};

function slugify(text) {
  return text.replace(/\W/g, ' ').trim().replace(/\s+/g, '-').toLowerCase();
}

export default (state: Provisioner.Project, config: FromAppStateConfig) => {
  if (typeof state === 'string') {
    if (config?.format === 'yaml') {
      state = yamlToJson(state);
    } else {
      state = JSON.parse(state);
    }
  }

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
  } = state;

  const proj: Partial<l.Project> = {
    name,
    description,
    collections,
    credentials,
    options,
  };

  proj.openfn = {
    uuid: id,
    endpoint: config.endpoint,
    env: config.env,
    inserted_at,
    updated_at,
  };

  // TODO maybe this for local metadata, stuff that isn't synced?
  proj.meta = {
    fetched_at: config.fetchedAt,
  };

  proj.workflows = state.workflows.map(mapWorkflow);

  return new Project(proj as l.Project, config?.repo);
};

const mapTriggerEdgeCondition = (edge: Provisioner.Edge) => {
  const e = {
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
    });
  });

  workflow.jobs.forEach((step: Provisioner.Job) => {
    const outboundEdges = edges.filter(
      (e) => e.source_job_id === step.id || e.source_trigger_id === step.id
    );

    const { body: expression, name, adaptor, ...remoteProps } = step;

    const s = {
      id: slugify(name),
      name: name,
      expression,
      adaptor,
      openfn: renameKeys(remoteProps, { id: 'uuid' }),
    };

    if (outboundEdges.length) {
      s.next = outboundEdges.reduce((next, edge) => {
        const target = jobs.find((j) => j.id === edge.target_job_id);
        next[slugify(target.name)] = mapTriggerEdgeCondition(edge);
        return next;
      }, {});
    }
    mapped.steps.push(s);
  });

  return mapped;
};
