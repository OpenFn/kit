/*
 * test utils
 */
import mock from 'mock-fs';
import path from 'node:path';

import type { ExecutionPlan, Job, StepEdge } from '@openfn/lexicon';

export const mockFs = (files: Record<string, string>) => {
  const pnpm = path.resolve('../../node_modules/.pnpm');
  mock({
    [pnpm]: mock.load(pnpm, {}),
    '/repo/': mock.load(path.resolve('test/__repo__/'), {}),
    ...files,
  });
};

export const resetMockFs = () => {
  mock.restore();
};

type CreateWorkflowOptions = {
  id?: string;
}

export const createWorkflow = (steps: Job[], options: CreateWorkflowOptions = {}) => {
  const { id = 'wf' } = options;

  return {
    id,
    workflow: { steps }
  } as ExecutionPlan;
}

type CreateStepOptions = {
  id?: string;
  expression?: string;
  adaptor?: string;
  next?: StepEdge
}

export const createStep = ({ id, expression, adaptor, next}: CreateStepOptions = {}) => ({
  id: id || 'a',
  expression: expression || '.',
  adaptor,
  next,
} as Job)