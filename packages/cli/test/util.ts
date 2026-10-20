/*
 * test utils
 */
import path from 'node:path';
import { loadPath, mockFs as mockMemFs, restoreFs } from './helpers/memfs';

import type { ExecutionPlan, Job, StepEdge } from '@openfn/runtime';

export const mockFs = (files: Record<string, string>) => {
  mockMemFs({
    '/repo/': loadPath(path.resolve('test/__repo__/')),
    ...files,
  });
};

export const resetMockFs = () => {
  restoreFs();
};

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
