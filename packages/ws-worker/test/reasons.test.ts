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
import { ExitReason } from '../src/types';

// Explicit tests of exit reasons coming out of the worker
// these test the onComplete callback
// uses the real runtime engine

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
  new Promise<{ reason: ExitReason; state: any }>((done) => {
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

test('success', async (t) => {
  const plan = createPlan({
    expression: '(s) => s',
  });

  plan.initialState = { data: { result: 42 } };

  const { reason } = await execute(plan);
  t.is(reason.reason, 'success');
});

test('fail: error on state', async (t) => {
  const plan = createPlan({
    expression:
      'export default [(s) => ({ errors: { "job-1": { "message": "err", "type": "Error" } } })]',
  });

  const { reason } = await execute(plan);
  t.is(reason.reason, 'fail');
  t.is(reason.error_message, 'err');
  t.is(reason.error_type, 'Error');
});

test('fail: type error', async (t) => {
  const plan = createPlan({
    expression: 'export default [(s) => { s.data = s.data.err.y; return s; }]',
  });

  const { reason } = await execute(plan);
  t.is(reason.reason, 'fail');
  t.is(
    reason.error_message,
    "TypeError: Cannot read properties of undefined (reading 'y')"
  );
  t.is(reason.error_type, 'TypeError');
});

test('fail: user error', async (t) => {
  const plan = createPlan({
    expression: 'export default [(s) => { throw "abort!"; }]',
  });

  const { reason } = await execute(plan);
  t.is(reason.reason, 'fail');
  t.is(reason.error_message, 'abort!');
  t.is(reason.error_type, 'UserError');
});

test('fail: user error in the third job', async (t) => {
  const plan = createPlan(
    {
      id: 'a',
      expression: 'export default [(s) => s ]',
      next: { b: true },
    },
    {
      id: 'b',
      expression: 'export default [(s) => s]',
      next: { c: true },
    },
    {
      id: 'c',
      expression: 'export default [(s) => { throw "abort!"; }]',
    }
  );

  const { reason } = await execute(plan);
  t.is(reason.reason, 'fail');
  t.is(reason.error_message, 'abort!');
  t.is(reason.error_type, 'UserError');
});

test('crash: reference error', async (t) => {
  const plan = createPlan({
    expression: 'export default [() => s]',
  });

  const { reason } = await execute(plan);
  t.is(reason.reason, 'crash');
  t.is(reason.error_message, 'ReferenceError: s is not defined');
  t.is(reason.error_type, 'ReferenceError');
});

test('crash: syntax error', async (t) => {
  const plan = createPlan({
    id: 'a',
    expression: 's lmkafekg a',
  });

  const { reason } = await execute(plan);
  t.is(reason.reason, 'crash');
  t.is(reason.error_type, 'CompileError');
  t.is(reason.error_message, 'a: Unexpected token (1:2)');
});

test.todo('crash: workflow validation error');
test.todo('fail: adaptor error');
test.todo('crash: import error');
test.todo('crash: no state returned'); // crash or fail? it'll break downstream stuff anyway, so crash

test.todo('kill: timeout error');
test.todo('kill: security error');
