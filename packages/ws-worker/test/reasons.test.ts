import test from 'ava';
import createRTE from '@openfn/engine-multi';
import { createMockLogger } from '@openfn/logger';

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

let engine;
let logger;

test.before(async () => {
  logger = createMockLogger();
  // logger = createLogger(null, { level: 'debug' });

  // Note: this is the REAL engine, not a mock
  engine = await createRTE({
    maxWorkers: 1,
    logger,
    autoinstall: {
      handleIsInstalled: async () => false,
      handleInstall: () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('not the way to amarillo')), 1);
        }),
    },
  });
});

test.after(async () => engine.destroy());

// Wrap up an execute call, capture the on complete state
const execute = async (plan, options = {}) =>
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

    const onFinish = (result) => {
      done(result);
    };

    // @ts-ignore
    doExecute(channel, engine, logger, plan, options, onFinish);
  });

test('success', async (t) => {
  const plan = createPlan({
    id: 'y',
    expression: '(s) => s',
  });

  plan.initialState = { data: { result: 42 } };

  const { reason } = await execute(plan);
  t.is(reason.reason, 'success');
});

test('fail: error on state', async (t) => {
  const plan = createPlan({
    id: 'x',
    expression:
      'export default [(s) => ({ errors: { "x": { "message": "err", "type": "Error" } } })]',
  });

  const { reason } = await execute(plan);
  t.is(reason.reason, 'fail');
  t.is(reason.error_message, 'err');
  t.is(reason.error_type, 'Error');
});

test('fail: type error', async (t) => {
  const plan = createPlan({
    id: 'z',
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
    id: 'w',
    expression: 'export default [(s) => { throw "abort!"; }]',
  });

  const { reason } = await execute(plan);
  t.is(reason.reason, 'fail');
  t.is(reason.error_message, 'abort!');
  t.is(reason.error_type, 'JobError');
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
  t.is(reason.error_type, 'JobError');
});

// We should ignore fails on non-leaf nodes (because a downstream leaf may anticipate and correct the error)
test('success: error in the second job, but ok in the third', async (t) => {
  const plan = createPlan(
    {
      id: 'a',
      expression: 'export default [(s) => s ]',
      next: { b: true },
    },
    {
      id: 'b',
      expression: 'export default [(s) => {throw "abort!"}]',
      next: { c: true },
    },
    {
      id: 'c',
      expression: 'export default [(s) => { s }]',
    }
  );

  const { reason } = await execute(plan);
  t.is(reason.reason, 'success');
  t.is(reason.error_message, null);
  t.is(reason.error_type, null);
});

test('fail: error in the first job, with downstream job that is not run', async (t) => {
  const plan = createPlan(
    {
      id: 'a',
      expression: 'export default [(s) => {throw "abort!"}]',
      next: { b: true },
    },
    {
      id: 'b',
    }
  );

  const { reason } = await execute(plan);
  t.is(reason.reason, 'fail');
  t.is(reason.error_message, 'abort!');
  t.is(reason.error_type, 'JobError');
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

test('exception: autoinstall error', async (t) => {
  const plan = createPlan({
    id: 'a',
    expression: '.',
    adaptor: '@openfn/language-common@1.0.0',
  });

  // TODO I also need to ensure that this calls attempt:complete
  // I think that test lives elsewhere though
  // I *think* I need to change the mock engine first though...
  const { reason } = await execute(plan);

  t.is(reason.reason, 'exception');
  t.is(reason.error_type, 'AutoinstallError');
  t.is(
    reason.error_message,
    'Error installing @openfn/language-common@1.0.0: not the way to amarillo'
  );
});

test('kill: timeout', async (t) => {
  const plan = createPlan({
    id: 'x',
    expression: 'export default [(s) => { while(true) { } }]',
  });

  const options = {
    attemptTimeoutMs: 100,
  };

  const { reason } = await execute(plan, options);
  t.is(reason.reason, 'kill');
  t.is(reason.error_type, 'TimeoutError');
  t.is(reason.error_message, 'Workflow failed to return within 100ms');
});

test.todo('crash: workflow validation error');
test.todo('fail: adaptor error');
test.todo('crash: import error');
test.todo('crash: no state returned'); // crash or fail? it'll break downstream stuff anyway, so crash

test.todo('kill: timeout error');
test.todo('kill: security error');
