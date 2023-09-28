import test from 'ava';
import { mockSocket, mockChannel } from '../../src/mock/sockets';
import joinAttemptChannel from '../../src/api/start-attempt';
import { GET_ATTEMPT } from '../../src/events';
import { loadAttempt } from '../../src/api/start-attempt';
import { attempts } from '../mock/data';

test('loadAttempt should get the attempt body', async (t) => {
  const attempt = attempts['attempt-1'];
  let didCallGetAttempt = false;
  const channel = mockChannel({
    [GET_ATTEMPT]: () => {
      // TODO should be no payload (or empty payload)
      didCallGetAttempt = true;
      return attempt;
    },
  });

  await loadAttempt(channel);
  t.true(didCallGetAttempt);
});

test('loadAttempt should return an execution plan', async (t) => {
  const attempt = attempts['attempt-1'];

  const channel = mockChannel({
    [GET_ATTEMPT]: () => attempt,
  });

  const plan = await loadAttempt(channel);
  t.deepEqual(plan, {
    id: 'attempt-1',
    jobs: [
      {
        id: 'trigger',
        configuration: 'a',
        expression: 'fn(a => a)',
        adaptor: '@openfn/language-common@1.0.0',
      },
    ],
  });
});

test('should join an attempt channel with a token', async (t) => {
  const socket = mockSocket('www', {
    'attempt:a': mockChannel({
      // Note that the validation logic is all handled here
      join: () => ({ status: 'ok' }),
      [GET_ATTEMPT]: () => ({
        id: 'a',
      }),
    }),
  });

  const { channel, plan } = await joinAttemptChannel(socket, 'x.y.z', 'a');

  t.truthy(channel);
  t.deepEqual(plan, { id: 'a', jobs: [] });
});

test('should fail to join an attempt channel with an invalid token', async (t) => {
  const socket = mockSocket('www', {
    'attempt:a': mockChannel({
      // Note that the validation logic is all handled here
      // We're not testing token validation, we're testing how we respond to auth fails
      join: () => ({ status: 'error', response: 'invalid-token' }),
      [GET_ATTEMPT]: () => ({
        id: 'a',
      }),
    }),
  });

  try {
    // ts-ignore
    await joinAttemptChannel(socket, 'x.y.z', 'a');
  } catch (e) {
    // the error here is whatever is passed as the response to the receive-error event
    t.is(e, 'invalid-token');
    t.pass();
  }
});
