// bunch of common utilities for comparing state and project files
// just a sketch/idea right now

import { Workflow } from '@openfn/lexicon';
import { Project } from '../Project';

// Given a workflow step, this will find the UUID for it in state
// TODO We probably need the workflow name too?
// Note that this is NOT a fuzzy matcher - that comes later. Maybe.
export const getUuidForStep = (
  project: Project,
  workflow: string | Workflow,
  stepId: string
) => {
  const wf =
    typeof workflow === 'string' ? project.getWorkflow(workflow) : workflow;
  if (!wf) {
    throw new Error(`Workflow "${workflow} not found in project ${project.id}`);
  }
  for (const step of wf.steps) {
    if (step.id === stepId) {
      return step.openfn?.id ?? null;
    }
  }
  return null;
};

// // Given a workflow step, find all the stuff that goes on the openfn key
// const getAppDataForStep = (step, state) => {};

// Given a step inside an edge, find the UUID for it in state
export const getUuidForEdge = (
  project: Project,
  workflow: string | Workflow,
  from: string,
  to: string
) => {
  const wf =
    typeof workflow === 'string' ? project.getWorkflow(workflow) : workflow;
  if (!wf) {
    throw new Error(
      `Workflow "${workflowId} not found in project ${project.id}`
    );
  }

  for (const step of wf.steps) {
    if (step.id === from) {
      for (const edge in step.next) {
        if (edge === to) {
          return step.next[edge].openfn?.id ?? null;
        }
      }
      break;
    }
  }

  return null;
};
