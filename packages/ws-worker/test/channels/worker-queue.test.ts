import test from 'ava';
import * as jose from 'jose';
import { createMockLogger } from '@openfn/logger';
import { API_VERSION } from '@openfn/lexicon/lightning';
import pkg from '../../package.json' assert { type: 'json' };

import connectToWorkerQueue from '../../src/channels/worker-queue';
import { mockSocket } from '../../src/mock/sockets';

const logger = createMockLogger();

test('should connect', async (t) => {
  return new Promise((done) => {
    connectToWorkerQueue(
      'www',
      'a',
      'secret',
      undefined,
      logger,
      mockSocket as any
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
      undefined,
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

test('should connect with api and worker versions', async (t) => {
  return new Promise((done) => {
    function createSocket(endpoint: string, options: any) {
      const socket = mockSocket(endpoint, {}, async () => {
        const { worker_version, api_version } = options.params;

        t.is(worker_version, pkg.version);
        t.truthy(worker_version);

        t.is(api_version, API_VERSION);
        t.truthy(api_version);
      });

      return socket;
    }

    connectToWorkerQueue(
      'www',
      'a',
      'secret',
      undefined,
      logger,
      createSocket as any
    ).on('connect', done);
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
      undefined,
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
