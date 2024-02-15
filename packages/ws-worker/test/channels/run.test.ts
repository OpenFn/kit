import test from 'ava';
import { mockSocket, mockChannel } from '../../src/mock/sockets';
import joinRunChannel, { loadRun } from '../../src/channels/run';
import { GET_PLAN } from '../../src/events';
import { runs } from '../mock/data';
import { createMockLogger } from '@openfn/logger';

test('loadRun should get the run body', async (t) => {
  const run = runs['run-1'];
  let didCallGetRun = false;
  const channel = mockChannel({
    [GET_PLAN]: () => {
      // TODO should be no payload (or empty payload)
      didCallGetRun = true;
      return run;
    },
  });

  await loadRun(channel);
  t.true(didCallGetRun);
});

test('loadRun should return an execution plan and options', async (t) => {
  const run = {
    ...runs['run-1'],
    options: {
      sanitize: 'obfuscate',
      runTimeoutMs: 10,
    },
  };

  const channel = mockChannel({
    [GET_PLAN]: () => run,
  });

  const { plan, options } = await loadRun(channel);
  t.like(plan, {
    id: 'run-1',
    workflow: {
      steps: [
        {
          id: 'job-1',
          configuration: 'a',
          expression: 'fn(a => a)',
          adaptor: '@openfn/language-common@1.0.0',
        },
      ],
    },
  });
  t.is(options.sanitize, 'obfuscate');
  t.is(options.runTimeoutMs, 10);
});

test('should join an run channel with a token', async (t) => {
  const logger = createMockLogger();
  const socket = mockSocket('www', {
    'run:a': mockChannel({
      // Note that the validation logic is all handled here
      join: () => ({ status: 'ok' }),
      [GET_PLAN]: () => ({
        id: 'a',
        options: { runTimeoutMs: 10 },
      }),
    }),
  });

  const { channel, plan, options } = await joinRunChannel(
    socket,
    'x.y.z',
    'a',
    logger
  );

  t.truthy(channel);
  t.deepEqual(plan, { id: 'a', workflow: { steps: [] }, options: {} });
  t.deepEqual(options, { runTimeoutMs: 10 });
});

test('should fail to join an run channel with an invalid token', async (t) => {
  const logger = createMockLogger();
  const socket = mockSocket('www', {
    'run:a': mockChannel({
      // Note that the validation logic is all handled here
      // We're not testing token validation, we're testing how we respond to auth fails
      join: () => ({ status: 'error', response: 'invalid-token' }),
      [GET_PLAN]: () => ({
        id: 'a',
      }),
    }),
  });

  try {
    // ts-ignore
    await joinRunChannel(socket, 'x.y.z', 'a', logger);
  } catch (e) {
    // the error here is whatever is passed as the response to the receive-error event
    t.is(e, 'invalid-token');
    t.pass();
  }
});
