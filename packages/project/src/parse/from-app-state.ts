// Load a Project from app state

import * as l from '@openfn/lexicon';
import { Provisioner } from '@openfn/lexicon/lightning';
import { Project } from '../Project';

// Extra metadata used to init the project
type Config = {
  endpoint: string;
  env?: string;
  fetchedAt?: string;
};

export default (state: Provisioner.Project, config: Config) => {
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
    name, // TODO do we need to slug this or anything?
    env: config.env,
    description,
    collections,
    credentials,
    options,
  };

  proj.openfn = {
    projectId: id,
    endpoint: config.endpoint,
    inserted_at,
    updated_at,
  };

  // TODO maybe this for local metadata, stuff that isn't synced?
  proj.meta = {
    fetched_at: config.fetchedAt,
  };

  proj.workflows = state.workflows.map(mapWorkflow);

  return new Project(proj as l.Project);
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
    id: edge.id,
  };
  return e;
};

// map a project workflow to a local cli workflow
// TODO this probably gets easier if I index everything by name
export const mapWorkflow = (workflow: Provisioner.Workflow) => {
  const { jobs, edges, triggers, name, ...remoteProps } = workflow;
  const mapped: l.Workflow = {
    name: workflow.name, // I think we map name not id?
    steps: [],
    openfn: remoteProps,
  };

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
      openfn: otherProps,
      next: connectedEdges.reduce((obj: any, edge) => {
        const target = jobs.find((j) => j.id === edge.target_job_id);
        // we use the name, not the id, to reference
        obj[target.name] = mapTriggerEdgeCondition(edge);
        return obj;
      }, {}),
    });
  });

  workflow.jobs.forEach((step: Provisioner.Job) => {
    const outboundEdges = edges.find(
      (e) => e.source_job_id === step.id || e.source_trigger_id === step.id
    );

    const { body: expression, name, adaptor, ...remoteProps } = step;

    const s = {
      id: name,
      expression,
      adaptor,
      openfn: remoteProps,
    };

    if (outboundEdges) {
      s.next = outboundEdges.reduce((next, edge) => {
        const target = jobs.find((j) => j.id === edge.target_job_id);
        next[target.name] = mapTriggerEdgeCondition(edge);
        return next;
      }, {});
    }
    mapped.steps.push(s);
  });

  return mapped;
};
