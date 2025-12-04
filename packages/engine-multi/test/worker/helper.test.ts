import test from 'ava';
import * as workerEvents from '../../src/worker/events';

import { execute, createLoggers } from '../../src/worker/thread/helpers';

test('createLogger: runtime logger should emit an event on log', (t) => {
  const message = 'testing1234';

  const publish = (type: string, payload: any) => {
    t.is(type, 'worker:log');
    t.is(payload.workflowId, 'x');
    t.is(payload.log.level, 'info');
    t.is(payload.log.name, 'R/T');

    // The log message is always encoded into a string
    const parsedMessage = JSON.parse(payload.log.message);
    t.deepEqual(parsedMessage, [message]);
  };

  const { logger } = createLoggers('x', 'none', publish);

  logger.log(message);
});

test('createLogger: runtime logger should emit a nicely serialised error on log', (t) => {
  const message = new Error('err');

  const publish = (type: string, payload: any) => {
    t.is(type, 'worker:log');

    const parsedMessage = JSON.parse(payload.log.message);
    t.deepEqual(parsedMessage, [
      {
        name: 'Error',
        message: 'err',
      },
    ]);
  };

  const { logger } = createLoggers('x', 'none', publish);

  logger.log(message);
});

test('execute: should call the run function', (t) => {
  let didCallRun = false;

  const run = async () => {
    // do something
    didCallRun = true;
  };

  execute('abc', run);

  t.true(didCallRun);
});

test('execute: should publish workflow-start', async (t) => {
  let event;

  const publish = async (eventName: string, payload: any) => {
    if (eventName === workerEvents.WORKFLOW_START) {
      event = payload;
    }
  };

  await execute('abc', async () => {}, { publish });

  t.deepEqual(event, { workflowId: 'abc' });
});

test('execute: should publish workflow-complete', async (t) => {
  let event;

  const publish = async (eventName: string, payload: any) => {
    if (eventName === workerEvents.WORKFLOW_COMPLETE) {
      event = payload;
    }
  };

  await execute('abc', async () => ({}), { publish });

  t.deepEqual(event, { workflowId: 'abc', state: {} });
});
