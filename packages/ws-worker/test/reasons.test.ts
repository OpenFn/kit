import test from 'ava';
import createRTE from '@openfn/engine-multi';
import createLogger, { createMockLogger } from '@openfn/logger';

import { createPlan } from './util';
import { execute as doExecute } from '../src/api/execute';
import { mockChannel } from '../src/mock/sockets';

import {
  RUN_START,
  RUN_COMPLETE,
  ATTEMPT_LOG,
  ATTEMPT_START,
  ATTEMPT_COMPLETE,
} from '../src/events';

// Explicit tests of exit reasons coming out of the worker
// these test the onComplete callback
// uses the real runtime engine

// WAIT is this JOB reasons or ATTEMPT reasons?
// Or both?
// If the attempt reason is just a job reason.... maybe we're just testing the final

let engine;
let logger;

test.before(async () => {
  logger = createMockLogger();
  // logger = createLogger(null, { level: 'debug' });

  engine = await createRTE({
    maxWorkers: 1,
    purge: false,
    logger,
  });
});

test.after(async () => engine.destroy());

// Wrap up an execute call, capture the on complete state
const execute = async (plan) =>
  new Promise<{ reason: string; state: any }>((done) => {
    // Ignore all channel events
    // In these test we assume that the correct messages are sent to the channel
    const channel = mockChannel({
      [ATTEMPT_START]: async () => true,
      [RUN_START]: async () => true,
      [ATTEMPT_LOG]: async () => true,
      [RUN_COMPLETE]: async () => true,
      [ATTEMPT_COMPLETE]: async () => true,
    });

    const onComplete = (result) => {
      done(result);
    };

    // @ts-ignore
    doExecute(channel, engine, logger, plan, {}, onComplete);
  });

test('ok', async (t) => {
  const plan = createPlan({
    expression: '(s) => s',
  });

  plan.initialState = { data: { result: 42 } };

  const { reason } = await execute(plan);
  t.is(reason, 'ok');
});

test('fail', async (t) => {
  const plan = createPlan({
    expression: 'export default [(s) => ({ errors: { "a": "err" } })]',
  });

  const { reason } = await execute(plan);
  t.is(reason, 'fail');
});
