import test from 'ava';

import { createLoggers } from '../../src/worker/thread/helpers';

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
