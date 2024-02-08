import test from 'ava';
import * as jose from 'jose';
import connectToWorkerQueue from '../../src/channels/worker-queue';
import { mockSocket } from '../../src/mock/sockets';
import { createMockLogger } from '@openfn/logger';

const logger = createMockLogger();

test('should connect', async (t) => {
  return new Promise((done) => {
    connectToWorkerQueue('www', 'a', 'secret', logger, mockSocket as any).on(
      'connect',
      ({ socket, channel }) => {
        t.truthy(socket);
        t.truthy(socket.connect);
        t.truthy(channel);
        t.truthy(channel.join);
        t.pass('connected');
        done();
      }
    );
  });
});

test('should connect with an auth token', async (t) => {
  return new Promise((done) => {
    const workerId = 'x';
    const secret = 'xyz';
    const encodedSecret = new TextEncoder().encode(secret);

    function createSocket(endpoint: string, options: any) {
      const socket = mockSocket(endpoint, {}, async () => {
        const { token } = options.params;

        const { payload } = await jose.jwtVerify(token, encodedSecret);
        t.is(payload.worker_id, workerId);
      });

      return socket;
    }
    connectToWorkerQueue(
      'www',
      workerId,
      secret,
      logger,
      createSocket as any
    ).on('connect', ({ socket, channel }) => {
      t.truthy(socket);
      t.truthy(socket.connect);
      t.truthy(channel);
      t.truthy(channel.join);
      t.pass('connected');
      done();
    });
  });
});

test('should fail to connect with an invalid auth token', async (t) => {
  return new Promise((done) => {
    const workerId = 'x';
    const secret = 'xyz';
    const encodedSecret = new TextEncoder().encode(secret);

    function createSocket(endpoint: string, options: any) {
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

    connectToWorkerQueue(
      'www',
      workerId,
      'wrong-secret!',
      logger,
      createSocket as any
    ).on('error', (e) => {
      t.is(e, 'auth_fail');
      t.pass('error thrown');
      done();
    });
  });
});

// TODO maybe?
test.todo('should reconnect with backoff when connection is dropped');
