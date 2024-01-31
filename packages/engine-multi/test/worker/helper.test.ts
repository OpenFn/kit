import test from 'ava';

import { createLoggers } from '../../src/worker/thread/helpers';

test('createLogger: runtime logger should emit an event on log', (t) => {
  const message = 'testing1234';

  const publish = (type: string, payload: any) => {
    t.is(type, 'worker:log');
    t.is(payload.workflowId, 'x');
    t.is(payload.message.level, 'info');
    t.is(payload.message.name, 'R/T');
    t.deepEqual(payload.message.message, [message]);
  };

  const { logger } = createLoggers('x', 'none', publish);

  logger.log(message);
});

test('createLogger: runtime logger should emit a nicely serialised error on log', (t) => {
  const message = new Error('err');

  const publish = (type: string, payload: any) => {
    t.is(type, 'worker:log');

    t.deepEqual(payload.message.message, [
      {
        name: 'Error',
        message: 'err',
      },
    ]);
  };

  const { logger } = createLoggers('x', 'none', publish);

  logger.log(message);
});
