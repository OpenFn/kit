import test from 'ava';
import createLightningServer from '../../src/server';

import { Socket } from 'phoenix';
import { WebSocket } from 'ws';

import { attempts, credentials, dataclips } from '../data';
import {
  ATTEMPT_COMPLETE,
  AttemptCompletePayload,
  ATTEMPT_LOG,
  CLAIM,
  GET_ATTEMPT,
  GET_CREDENTIAL,
  GET_DATACLIP,
} from '../../src/events';
import type { Attempt } from '../../src/types';
import { JSONLog } from '@openfn/logger';

const endpoint = 'ws://localhost:7777/worker';

const enc = new TextDecoder('utf-8');

type Channel = any;

let server;
let client;

// Set up a lightning server and a phoenix socket client before each test
test.before(
  () =>
    new Promise((done) => {
      server = createLightningServer({ port: 7777 });

      // Note that we need a token to connect, but the mock here
      // doesn't (yet) do any validation on that token
      client = new Socket(endpoint, {
        params: { token: 'x.y.z' },
        timeout: 1000 * 120,
        transport: WebSocket,
      });
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

const join = (channelName: string, params: any = {}): Promise<Channel> =>
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
    channel.push(GET_ATTEMPT).receive('ok', (attempt) => {
      t.deepEqual(attempt, attempt1);
      done();
    });
  });
});

test.serial('complete an attempt through the attempt channel', async (t) => {
  return new Promise(async (done) => {
    const a = attempt1;
    server.registerAttempt(a);
    server.startAttempt(a.id);
    server.addDataclip('abc', { answer: 42 });

    const channel = await join(`attempt:${a.id}`, { token: 'a.b.c' });
    channel
      .push(ATTEMPT_COMPLETE, { final_dataclip_id: 'abc' })
      .receive('ok', () => {
        const { pending, results } = server.getState();
        t.deepEqual(pending[a.id], { status: 'complete', logs: [] });
        t.deepEqual(results[a.id].state, { answer: 42 });
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
      const str = enc.decode(new Uint8Array(result));
      const dataclip = JSON.parse(str);
      t.deepEqual(dataclip, dataclips['d']);
      done();
    });
  });
});

// TODO test that all events are proxied out to server.on

test.serial(
  'waitForResult should return logs and dataclip when an attempt is completed',
  async (t) => {
    return new Promise(async (done) => {
      const result = { answer: 42 };

      server.startAttempt(attempt1.id);
      server.addDataclip('result', result);

      server.waitForResult(attempt1.id).then((dataclip) => {
        t.deepEqual(result, dataclip);
        done();
      });

      const channel = await join(`attempt:${attempt1.id}`, { token: 'a.b.c' });
      channel.push(ATTEMPT_COMPLETE, {
        final_dataclip_id: 'result',
      } as AttemptCompletePayload);
    });
  }
);

// TODO this should probably return reason AND state?
test.serial(
  'getResult should return the correct resulting dataclip',
  async (t) => {
    return new Promise(async (done) => {
      const result = { answer: 42 };

      server.startAttempt(attempt1.id);
      server.addDataclip('result', result);

      server.waitForResult(attempt1.id).then(() => {
        const dataclip = server.getResult(attempt1.id);
        t.deepEqual(result, dataclip);
        done();
      });

      const channel = await join(`attempt:${attempt1.id}`, { token: 'a.b.c' });
      channel.push(ATTEMPT_COMPLETE, {
        final_dataclip_id: 'result',
      } as AttemptCompletePayload);
    });
  }
);

// test.serial('getLogs should return logs', async (t) => {});
