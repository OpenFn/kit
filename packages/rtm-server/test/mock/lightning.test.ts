import test from 'ava';
import createLightningServer, { API_PREFIX } from '../../src/mock/lightning';

import phx from 'phoenix-channels';

import { attempts, credentials, dataclips } from './data';
import {
  ATTEMPT_COMPLETE,
  ATTEMPT_LOG,
  CLAIM,
  GET_ATTEMPT,
  GET_CREDENTIAL,
  GET_DATACLIP,
} from '../../src/events';
import type { Attempt } from '../../src/types';
import { JSONLog } from '@openfn/logger';

const endpoint = 'ws://localhost:7777/api';

let server;
let client;

// Set up a lightning server and a phoenix socket client before each test
test.before(
  () =>
    new Promise((done) => {
      server = createLightningServer({ port: 7777 });

      // Note that we need a token to connect, but the mock here
      // doesn't (yet) do any validation on that token
      client = new phx.Socket(endpoint, { params: { token: 'x.y.z' } });
      client.onOpen(done);
      client.connect();
    })
);

test.afterEach(() => {
  server.reset();
});

test.after(() => {
  server.destroy();
});

const attempt1 = attempts['attempt-1'];

const join = (
  channelName: string,
  params: any = {}
): Promise<typeof phx.Channel> =>
  new Promise((done, reject) => {
    const channel = client.channel(channelName, params);
    channel
      .join()
      .receive('ok', () => {
        done(channel);
      })
      .receive('error', (err) => {
        // err will be the response message on the payload (ie, invalid_token, invalid_attempt_id etc)
        reject(new Error(err));
      });
  });

// Test some dev hooks
// enqueue attempt should add id to the queue and register the state, credentials and body
test.serial('should setup an attempt at /POST /attempt', async (t) => {
  const state = server.getState();

  t.is(Object.keys(state.credentials).length, 0);
  t.is(Object.keys(state.attempts).length, 0);
  t.is(Object.keys(state.attempts).length, 0);

  const attempt: Attempt = {
    id: 'a',
    triggers: [],
    jobs: [
      {
        body: 'abc',
        dataclip: {}, // not sure how this will work on the attempt yet
        credential: {
          // this will be converted into a string for lazy loading
          user: 'john',
          password: 'rambo',
        },
      },
    ],
    edges: [],
  };

  await fetch('http://localhost:7777/attempt', {
    method: 'POST',
    body: JSON.stringify(attempt),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  const newState = server.getState();
  t.is(Object.keys(newState.attempts).length, 1);
  const a = server.getAttempt('a');
  t.truthy(a);
  t.is(server.getQueueLength(), 1);

  t.is(Object.keys(newState.credentials).length, 1);

  const job = a.jobs[0];
  t.assert(typeof job.credential === 'string');
  const c = server.getCredential(job.credential);
  t.is(c.user, 'john');
});

test.serial('provide a phoenix websocket at /api', (t) => {
  // client should be connected before this test runs
  t.is(client.connectionState(), 'open');
});

test.serial('reject ws connections without a token', (t) => {
  return new Promise((done) => {
    // client should be connected before this test runs
    const socket = new phx.Socket(endpoint);
    socket.onClose(() => {
      t.pass();
      done();
    });
    socket.connect();
  });
});

test.serial('respond to channel join requests', (t) => {
  return new Promise(async (done, reject) => {
    const channel = client.channel('x', {});

    channel.join().receive('ok', (res) => {
      t.is(res, 'ok');
      done();
    });
  });
});

// TODO: only allow authorised workers to join workers
// TODO: only allow authorised attemtps to join an attempt channel

test.serial('get a reply to a ping event', (t) => {
  return new Promise(async (done) => {
    const channel = await join('test');

    channel.on('pong', (payload) => {
      t.pass('message received');
      done();
    });

    channel.push('ping');
  });
});

test.serial(
  'claim attempt: reply for zero items if queue is empty',
  (t) =>
    new Promise(async (done) => {
      t.is(server.getQueueLength(), 0);

      const channel = await join('attempts:queue');

      // response is an array of attempt ids
      channel.push(CLAIM).receive('ok', (response) => {
        t.assert(Array.isArray(response));
        t.is(response.length, 0);

        t.is(server.getQueueLength(), 0);
        done();
      });
    })
);

test.serial(
  "claim attempt: reply with an attempt id if there's an attempt in the queue",
  (t) =>
    new Promise(async (done) => {
      server.enqueueAttempt(attempt1);
      t.is(server.getQueueLength(), 1);

      // This uses a shared channel at all workers sit in
      // They all yell from time to time to ask for work
      // Lightning responds with an attempt id and server id (target)
      // What if:
      // a) each worker has its own channel, so claims are handed out privately
      // b) we use the 'ok' status to return work in the response
      // this b pattern is much nicer
      const channel = await join('attempts:queue');

      // response is an array of attempt ids
      channel.push(CLAIM).receive('ok', (response) => {
        t.truthy(response);
        t.is(response.length, 1);
        t.deepEqual(response[0], { id: 'attempt-1', token: 'x.y.z' });

        // ensure the server state has changed
        t.is(server.getQueueLength(), 0);
        done();
      });
    })
);

// TODO is it even worth doing this? Easier for a socket to pull one at a time?
// It would also ensure better distribution if 10 workers ask at the same time, they'll get
// one each then come back for more
test.todo('claim attempt: reply with multiple attempt ids');

test.serial('create a channel for an attempt', async (t) => {
  server.startAttempt('wibble');
  await join('attempt:wibble', { token: 'a.b.c' });
  t.pass('connection ok');
});

test.serial('do not allow to join a channel without a token', async (t) => {
  server.startAttempt('wibble');
  await t.throwsAsync(() => join('attempt:wibble'), {
    message: 'invalid_token',
  });
});

test.todo('do not allow to join a channel without a valid token');

test.serial('reject channels for attempts that are not started', async (t) => {
  await t.throwsAsync(() => join('attempt:xyz'), {
    message: 'invalid_attempt_id',
  });
});

test.serial('get attempt data through the attempt channel', async (t) => {
  return new Promise(async (done) => {
    server.registerAttempt(attempt1);
    server.startAttempt(attempt1.id);

    const channel = await join(`attempt:${attempt1.id}`, { token: 'a.b.c' });
    channel.push(GET_ATTEMPT).receive('ok', (p) => {
      t.deepEqual(p, attempt1);
      done();
    });
  });
});

test.serial('complete an attempt through the attempt channel', async (t) => {
  return new Promise(async (done) => {
    const a = attempt1;
    server.registerAttempt(a);
    server.startAttempt(a.id);

    const channel = await join(`attempt:${a.id}`, { token: 'a.b.c' });
    channel
      .push(ATTEMPT_COMPLETE, { dataclip: { answer: 42 } })
      .receive('ok', () => {
        const { pending, results } = server.getState();
        t.deepEqual(pending[a.id], { status: 'complete', logs: [] });
        t.deepEqual(results[a.id], { answer: 42 });
        done();
      });
  });
});

test.serial('logs are saved and acknowledged', async (t) => {
  return new Promise(async (done) => {
    server.registerAttempt(attempt1);
    server.startAttempt(attempt1.id);

    const log = {
      attempt_id: attempt1.id,
      level: 'info',
      name: 'R/T',
      message: ['Did the thing'],
      time: new Date().getTime(),
    } as JSONLog;

    const channel = await join(`attempt:${attempt1.id}`, { token: 'a.b.c' });
    channel.push(ATTEMPT_LOG, log).receive('ok', () => {
      const { pending } = server.getState();
      const [savedLog] = pending[attempt1.id].logs;
      t.deepEqual(savedLog, log);
      done();
    });
  });
});

test.serial('unsubscribe after attempt complete', async (t) => {
  return new Promise(async (done) => {
    const a = attempt1;
    server.registerAttempt(a);
    server.startAttempt(a.id);

    const channel = await join(`attempt:${a.id}`, { token: 'a.b.c' });
    channel.push(ATTEMPT_COMPLETE).receive('ok', () => {
      // After the complete event, the listener should unsubscribe to the channel
      // The mock will send an error to any unhandled events in that channel
      channel.push(ATTEMPT_COMPLETE).receive('error', () => {
        t.pass();
        done();
      });
    });
  });
});

test.serial('get credential through the attempt channel', async (t) => {
  return new Promise(async (done) => {
    server.startAttempt(attempt1.id);
    server.addCredential('a', credentials['a']);

    const channel = await join(`attempt:${attempt1.id}`, { token: 'a.b.c' });
    channel.push(GET_CREDENTIAL, { id: 'a' }).receive('ok', (result) => {
      t.deepEqual(result, credentials['a']);
      done();
    });
  });
});

test.serial('get dataclip through the attempt channel', async (t) => {
  return new Promise(async (done) => {
    server.startAttempt(attempt1.id);
    server.addDataclip('d', dataclips['d']);

    const channel = await join(`attempt:${attempt1.id}`, { token: 'a.b.c' });
    channel.push(GET_DATACLIP, { id: 'd' }).receive('ok', (result) => {
      t.deepEqual(result, dataclips['d']);
      done();
    });
  });
});

// TODO test that all events are proxied out to server.on

test.serial(
  'waitForResult should return logs and dataclip when an attempt is completed',
  async (t) => {
    return new Promise(async (done) => {
      server.startAttempt(attempt1.id);
      server.addDataclip('d', dataclips['d']);
      const result = { answer: 42 };

      server
        .waitForResult(attempt1.id)
        .then(({ attemptId, dataclip, logs }) => {
          t.is(attemptId, attempt1.id);
          t.deepEqual(result, dataclip);
          t.deepEqual(logs, []);
          done();
        });

      const channel = await join(`attempt:${attempt1.id}`, { token: 'a.b.c' });
      channel.push(ATTEMPT_COMPLETE, { dataclip: result });
    });
  }
);

// test.serial('getLogs should return logs', async (t) => {});
