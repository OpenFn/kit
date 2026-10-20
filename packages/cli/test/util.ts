/*
 * test utils
 */
import type { ExecutionPlan, Job, StepEdge } from '@openfn/runtime';

type CreateWorkflowOptions = {
  id?: string;
};

export const createWorkflow = (
  steps: Job[],
  options: CreateWorkflowOptions = {}
) => {
  const { id = 'wf' } = options;

  return {
    id,
    workflow: { steps },
  } as ExecutionPlan;
};

type CreateStepOptions = {
  id?: string;
  name?: string;
  expression?: string;
  adaptor?: string;
  next?: StepEdge;
};

export const createStep = ({
  id,
  expression,
  name,
  adaptor,
  next,
}: CreateStepOptions = {}) =>
  ({
    id: id || 'a',
    name,
    expression: expression || '.',
    adaptor,
    next,
  } as Job);
