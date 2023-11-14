import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import { NOTIFY_JOB_COMPLETE, NOTIFY_JOB_START } from '../../src';
import execute from '../../src/execute/job';

import type { ExecutionContext, State } from '../../src/types';

const createState = (data = {}) => ({
  data: data,
  configuration: {},
});

const logger = createMockLogger(undefined, { level: 'debug' });

const createContext = (args = {}) =>
  ({
    logger,
    plan: {},
    opts: {},
    notify: () => {},
    report: () => {},
    ...args,
  } as unknown as ExecutionContext);

test.afterEach(() => {
  logger._reset();
});

test(`notify ${NOTIFY_JOB_START}`, async (t) => {
  const job = {
    id: 'j',
    expression: [(s: State) => s],
  };
  const state = createState();

  const notify = (event: string, payload?: any) => {
    if (event === NOTIFY_JOB_START) {
      t.is(payload.jobId, 'j');
    }
  };

  const context = createContext({ notify });

  await execute(context, job, state);
});

test(`notify ${NOTIFY_JOB_COMPLETE}`, async (t) => {
  const job = {
    id: 'j',
    expression: [(s: State) => s],
  };

  const state = createState();

  const notify = (event: string, payload: any) => {
    if (event === NOTIFY_JOB_COMPLETE) {
      const { state, duration, jobId } = payload;
      t.truthy(state);
      t.deepEqual(state, state);
      t.assert(!isNaN(duration));
      t.is(jobId, 'j');
    }
  };

  const context = createContext({ notify });

  await execute(context, job, state);
});

test(`notify ${NOTIFY_JOB_COMPLETE} should publish serializable state`, async (t) => {
  // Promises will trigger an exception if you try to serialize them
  // If we don't return finalState in  execute/expression, this test will fail
  const resultState = { x: new Promise((r) => r), y: 22 };
  const job = {
    id: 'j',
    expression: [() => resultState],
  };
  const state = createState();

  const notify = (event: string, payload: any) => {
    if (event === NOTIFY_JOB_COMPLETE) {
      const { state, duration, jobId } = payload;
      t.truthy(state);
      t.assert(!isNaN(duration));
      t.is(jobId, 'j');
    }
  };

  const context = createContext({ notify });

  await execute(context, job, state);
});
