// Load a Project from app state

import * as l from '@openfn/lexicon';
import { Provisioner } from '@openfn/lexicon/lightning';
import { Project } from '../project';

// TODO need to work out how to map versions
// the state file should be able to handle multiple versions of provisioner files
/// project id in config isn't needed here
// TODO maybe the sig is (state, endpoint, name = main)
export default (
  state: Provisioner.Project,
  config: Partial<l.ProjectConfig>
) => {
  const proj: Partial<l.Project> = {};

  proj.openfn = {
    projectId: state.id,
    endpoint: config.endpoint,
    name: config.name,
    inserted_at: state.inserted_at,
    updated_at: state.updated_at,
    fetched_at: config.fetched_at, // how do we set this? It needs passing in
  };

  proj.workflows = state.workflows.map(mapWorkflow);

  return new Project(proj as l.Project, config as l.ProjectConfig);
};

const mapTriggerEdgeCondition = (edge: Provisioner.Edge) => {
  if (edge.condition_type === 'always') {
    return true;
  }
  if (edge.condition_type === 'never') {
    return false;
  }
  return edge.condition_expression;
};

// map a project workflow to a local cli workflow
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
        console.log({ target });
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
