import test from 'ava';
import * as jose from 'jose';
import { createMockLogger } from '@openfn/logger';
import { API_VERSION } from '@openfn/lexicon/lightning';

import connectToWorkerQueue from '../../src/channels/worker-queue';
import { MockSocket } from '../../src/mock/sockets';
import loadVersion from '../../src/util/load-version';

const logger = createMockLogger();

test('should connect', (t) => {
  return new Promise((done) => {
    connectToWorkerQueue('www', 'a', 'secret', logger, {
      SocketConstructor: MockSocket as any,
    }).on('connect', ({ socket, channel }) => {
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
      const socket = new MockSocket(endpoint, {}, async () => {
        const { token } = options.params;

        const { payload } = await jose.jwtVerify(token, encodedSecret);
        t.is(payload.worker_id, workerId);
      });

      return socket;
    }
    connectToWorkerQueue('www', workerId, secret, logger, {
      SocketConstructor: createSocket,
    }).on('connect', ({ socket, channel }) => {
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
  const version = await loadVersion();
  return new Promise((done) => {
    function createSocket(endpoint: string, options: any) {
      const socket = new MockSocket(endpoint, {}, async () => {
        const { worker_version, api_version } = options.params;

        t.is(worker_version, version);
        t.truthy(worker_version);

        t.is(api_version, API_VERSION);
        t.truthy(api_version);
      });

      return socket;
    }

    connectToWorkerQueue('www', 'a', 'secret', logger, {
      SocketConstructor: createSocket as any,
    }).on('connect', done);
  });
});

test('should fail to connect with an invalid auth token', async (t) => {
  return new Promise((done) => {
    const workerId = 'x';
    const secret = 'xyz';
    const encodedSecret = new TextEncoder().encode(secret);

    function createSocket(endpoint: string, options: any) {
      const socket = new MockSocket(endpoint, {}, async () => {
        const { token } = options.params;

        try {
          await jose.jwtVerify(token, encodedSecret);
        } catch (_e) {
          throw new Error('auth_fail');
        }
      });

      return socket;
    }

    connectToWorkerQueue('www', workerId, 'wrong-secret!', logger, {
      SocketConstructor: createSocket,
    }).on('error', (e) => {
      t.is(e, 'auth_fail');
      t.pass('error thrown');
      done();
    });
  });
});

test('should pass capacity in join payload when provided', (t) => {
  return new Promise((done) => {
    function createSocket(endpoint: string, _options: any) {
      const socket = new MockSocket(endpoint, {}, async () => {});

      // Override channel method to capture join params
      const originalChannel = socket.channel.bind(socket);
      socket.channel = (topic: string, params?: any) => {
        const channel = originalChannel(topic, params);
        if (topic === 'worker:queue') {
          t.truthy(params);
          t.is(params.capacity, 10);
        }
        return channel;
      };

      return socket;
    }

    connectToWorkerQueue('www', 'a', 'secret', logger, {
      capacity: 10,
      SocketConstructor: createSocket as any,
    }).on('connect', () => {
      t.pass('connected with capacity');
      done();
    });
  });
});

test('should not pass capacity in join payload when not provided', (t) => {
  return new Promise((done) => {
    function createSocket(endpoint: string, _options: any) {
      const socket = new MockSocket(endpoint, {}, async () => {});

      // Override channel method to capture join params
      const originalChannel = socket.channel.bind(socket);
      socket.channel = (topic: string, params?: any) => {
        const channel = originalChannel(topic, params);
        if (topic === 'worker:queue') {
          t.deepEqual(params, {});
        }
        return channel;
      };

      return socket;
    }

    connectToWorkerQueue('www', 'a', 'secret', logger, {
      SocketConstructor: createSocket as any,
    }).on('connect', () => {
      t.pass('connected without capacity');
      done();
    });
  });
});

// TODO maybe?
test.todo('should reconnect with backoff when connection is dropped');
