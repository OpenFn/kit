import test from 'ava';
import * as jose from 'jose';
import connectToWorkerQueue from '../../src/channels/worker-queue';
import { mockSocket } from '../../src/mock/sockets';

test('should connect', async (t) => {
  const { socket, channel } = await connectToWorkerQueue(
    'www',
    'a',
    'secret',
    mockSocket
  );

  t.truthy(socket);
  t.truthy(socket.connect);
  t.truthy(channel);
  t.truthy(channel.join);
});

test('should connect with an auth token', async (t) => {
  const workerId = 'x';
  const secret = 'xyz';
  const encodedSecret = new TextEncoder().encode(secret);

  function createSocket(endpoint, options) {
    const socket = mockSocket(endpoint, {}, async () => {
      const { token } = options.params;

      const { payload } = await jose.jwtVerify(token, encodedSecret);
      t.is(payload.worker_id, workerId);
    });

    return socket;
  }
  const { socket, channel } = await connectToWorkerQueue(
    'www',
    workerId,
    secret,
    createSocket
  );

  t.truthy(socket);
  t.truthy(socket.connect);
  t.truthy(channel);
  t.truthy(channel.join);
});

test('should fail to connect with an invalid auth token', async (t) => {
  const workerId = 'x';
  const secret = 'xyz';
  const encodedSecret = new TextEncoder().encode(secret);

  function createSocket(endpoint, options) {
    const socket = mockSocket(endpoint, {}, async () => {
      const { token } = options.params;

      try {
        await jose.jwtVerify(token, encodedSecret);
      } catch (_e) {
        throw new Error('auth_fail');
      }
    });

    return socket;
  }

  await t.throwsAsync(
    connectToWorkerQueue('www', workerId, 'wrong-secret!', createSocket),
    {
      message: 'auth_fail',
    }
  );
});

// TODO maybe?
test.todo('should reconnect with backoff when connection is dropped');
