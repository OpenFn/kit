import test from 'ava';
import mock from 'mock-fs';
import { createMockLogger } from '@openfn/logger';
import loadInput from '../../src/util/load-input';

const logger = createMockLogger(undefined, { level: 'debug' });

test.after(() => {
  logger._reset();
  mock.restore();
});

mock({
  'test/job.js': 'x',
  'test/wf.json': JSON.stringify({
    start: 'a',
    jobs: {
      a: { expression: 'x()' },
    },
  }),
  'test/wf-err.json': '!!!',
});

test('do nothing if no path provided', async (t) => {
  const opts = {};

  const result = await loadInput(opts, logger);
  t.falsy(result);
  t.assert(Object.keys(opts).length === 0);
});

test('return the workflow if already set ', async (t) => {
  const opts = {
    workflow: { start: 'x ' },
    job: 'j',
    jobPath: 'test/job.js',
  };

  const result = await loadInput(opts, logger);
  t.truthy(result);
  t.is(result.start, 'x');
});

test('return the job if already set (and workflow is not)', async (t) => {
  const opts = {
    job: 'j',
    jobPath: 'test/job.js',
  };

  const result = await loadInput(opts, logger);
  t.truthy(result);
  t.is(result.start, 'x');
});

test('load a job from a path and return the result', async (t) => {
  const opts = {
    jobPath: 'test/job.js',
  };

  const result = await loadInput(opts, logger);
  t.is(result, 'x');
});

test('load a job from a path and mutate opts', async (t) => {
  const opts = {
    jobPath: 'test/job.js',
    job: '',
  };

  await loadInput(opts, logger);
  t.is(opts.job, 'x');
});

test('load a workflow from a path and return the result as JSON', async (t) => {
  const opts = {
    workflowPath: 'test/wf.json',
  };

  const result = await loadInput(opts, logger);
  t.is(result.start, 'a');
});

test('load a workflow from a path and mutate opts', async (t) => {
  const opts = {
    workflowPath: 'test/wf.json',
    workflow: {},
  };

  await loadInput(opts, logger);
  t.is((opts.workflow as any).start, 'a');
});

test('throw if workflow json is invalid', async (t) => {
  const opts = {
    workflowPath: 'test/wf-err.json',
  };

  await t.throwsAsync(() => loadInput(opts, logger));
});

test('prefer workflow to job if both are somehow set', async (t) => {
  const opts = {
    jobPath: 'test/job.js',
    workflowPath: 'test/wf.json',
  };

  const result = await loadInput(opts, logger);
  t.is(result.start, 'a');
});
