import test from 'ava';
import { MockSocket, mockChannel } from '../../src/mock/sockets';
import joinRunChannel from '../../src/channels/run';
import { GET_PLAN } from '../../src/events';
import { runs } from '../mock/data';
import { createMockLogger } from '@openfn/logger';

test('should join a run channel with a token and return a raw lightning run', async (t) => {
  const logger = createMockLogger();
  const socket = new MockSocket('www', {
    'run:a': mockChannel({
      // Note that the validation logic is all handled here
      join: () => ({ status: 'ok' }),
      [GET_PLAN]: () => runs['run-1'],
    }),
  });

  const { channel, run } = await joinRunChannel(socket, 'x.y.z', 'a', logger);

  t.truthy(channel);
  t.deepEqual(run, runs['run-1']);
});

test('should fail to join an run channel with an invalid token', async (t) => {
  const logger = createMockLogger();
  const socket = new MockSocket('www', {
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

test('should reject (not hang) when fetch:plan replies an error', async (t) => {
  const logger = createMockLogger();
  const socket = new MockSocket('www', {
    'run:a': mockChannel({
      join: () => ({ status: 'ok' }),
      [GET_PLAN]: () => {
        throw { reason: 'adaptor_not_ready' };
      },
    }),
  });

  // race against a short timeout so a hang fails fast instead of hanging CI
  const result = await Promise.race([
    joinRunChannel(socket, 'x.y.z', 'a', logger).then(
      () => 'resolved',
      () => 'rejected'
    ),
    new Promise((resolve) => setTimeout(() => resolve('timed-out'), 200)),
  ]);

  // 'timed-out' would mean joinRunChannel's promise never settled
  t.is(result, 'rejected');
});

test('should log an error including channel state when the channel errors', async (t) => {
  const logger = createMockLogger();
  const channel = mockChannel({
    join: () => ({ status: 'ok' }),
    [GET_PLAN]: () => runs['run-1'],
  });
  const socket = new MockSocket('www', { 'run:a': channel });

  await joinRunChannel(socket, 'x.y.z', 'a', logger);

  channel.state = 'errored';
  channel._triggerError('boom');

  const log = logger._find('error', /Critical error in channel run:a/);
  t.truthy(log);
  t.regex(log!.message as string, /errored/);
});
