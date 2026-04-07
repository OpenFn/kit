/*
 * test utils
 */
import mock from 'mock-fs';
import path from 'node:path';

import type { ExecutionPlan, Job, StepEdge } from '@openfn/lexicon';

export const mockFs = (files: Record<string, string>) => {
  // We have to explicitly expose some modules paths so that dependencies can run in the tests
  const pnpm = path.resolve('../../node_modules/.pnpm');
  const recastPath = `${pnpm}/recast@0.21.5`;
  const sourceMapPath = `${pnpm}/source-map@0.7.6`;
  mock({
    [recastPath]: mock.load(recastPath, {}),
    [sourceMapPath]: mock.load(sourceMapPath, {}),
    '/repo/': mock.load(path.resolve('test/__repo__/'), {}),
    ...files,
  });
};

export const resetMockFs = () => {
  mock.restore();
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
