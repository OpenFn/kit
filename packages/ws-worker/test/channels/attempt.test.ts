import test from 'ava';
import { mockSocket, mockChannel } from '../../src/mock/sockets';
import joinAttemptChannel, { loadAttempt } from '../../src/channels/attempt';
import { GET_RUN } from '../../src/events';
import { attempts } from '../mock/data';
import { createMockLogger } from '@openfn/logger';

test('loadAttempt should get the attempt body', async (t) => {
  const attempt = attempts['attempt-1'];
  let didCallGetAttempt = false;
  const channel = mockChannel({
    [GET_RUN]: () => {
      // TODO should be no payload (or empty payload)
      didCallGetAttempt = true;
      return attempt;
    },
  });

  await loadAttempt(channel);
  t.true(didCallGetAttempt);
});

test('loadAttempt should return an execution plan and options', async (t) => {
  const attempt = {
    ...attempts['attempt-1'],
    options: {
      sanitize: 'obfuscate',
      attemptTimeoutMs: 10,
    },
  };

  const channel = mockChannel({
    [GET_RUN]: () => attempt,
  });

  const { plan, options } = await loadAttempt(channel);
  t.like(plan, {
    id: 'attempt-1',
    jobs: [
      {
        id: 'job-1',
        configuration: 'a',
        expression: 'fn(a => a)',
        adaptor: '@openfn/language-common@1.0.0',
      },
    ],
  });
  t.is(options.sanitize, 'obfuscate');
  t.is(options.attemptTimeoutMs, 10);
});

test('should join an attempt channel with a token', async (t) => {
  const logger = createMockLogger();
  const socket = mockSocket('www', {
    'attempt:a': mockChannel({
      // Note that the validation logic is all handled here
      join: () => ({ status: 'ok' }),
      [GET_RUN]: () => ({
        id: 'a',
        options: { attemptTimeoutMs: 10 },
      }),
    }),
  });

  const { channel, plan, options } = await joinAttemptChannel(
    socket,
    'x.y.z',
    'a',
    logger
  );

  t.truthy(channel);
  t.deepEqual(plan, { id: 'a', jobs: [] });
  t.deepEqual(options, { attemptTimeoutMs: 10 });
});

test('should fail to join an attempt channel with an invalid token', async (t) => {
  const logger = createMockLogger();
  const socket = mockSocket('www', {
    'attempt:a': mockChannel({
      // Note that the validation logic is all handled here
      // We're not testing token validation, we're testing how we respond to auth fails
      join: () => ({ status: 'error', response: 'invalid-token' }),
      [GET_RUN]: () => ({
        id: 'a',
      }),
    }),
  });

  try {
    // ts-ignore
    await joinAttemptChannel(socket, 'x.y.z', 'a', logger);
  } catch (e) {
    // the error here is whatever is passed as the response to the receive-error event
    t.is(e, 'invalid-token');
    t.pass();
  }
});
