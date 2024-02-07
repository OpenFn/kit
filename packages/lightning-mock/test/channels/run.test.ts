import test from 'ava';
import type {
  Run,
  RunCompletePayload,
  Credential,
  DataClip,
} from '@openfn/lexicon/lightning';

import { setup } from '../util';
import { runs, credentials, dataclips } from '../data';
import {
  RUN_COMPLETE,
  GET_PLAN,
  GET_CREDENTIAL,
  GET_DATACLIP,
} from '../../src/events';

const enc = new TextDecoder('utf-8');

type Channel = any;

const port = 7777;

let server: any;
let client: any;

// Set up a lightning server and a phoenix socket client before each test
test.before(async () => ({ server, client } = await setup(port)));

test.afterEach(() => {
  server.reset();
});

test.after(() => {
  server.destroy();
});

const run1 = runs['run-1'];

const join = (channelName: string, params: any = {}): Promise<Channel> =>
  new Promise((done, reject) => {
    const channel = client.channel(channelName, params);
    channel
      .join()
      .receive('ok', () => {
        done(channel);
      })
      .receive('error', (err: any) => {
        // err will be the response message on the payload (ie, invalid_token, invalid_run_id etc)
        reject(new Error(err));
      });
  });

test.serial('create a channel for an run', async (t) => {
  server.startRun('wibble');
  await join('run:wibble', { token: 'a.b.c' });
  t.pass('connection ok');
});

test.serial('do not allow to join a channel without a token', async (t) => {
  server.startRun('wibble');
  await t.throwsAsync(() => join('run:wibble'), {
    message: 'invalid_token',
  });
});

test.serial('reject channels for runs that are not started', async (t) => {
  await t.throwsAsync(() => join('run:xyz'), {
    message: 'invalid_run_id',
  });
});

test.serial('get run data through the run channel', async (t) => {
  return new Promise(async (done) => {
    server.registerRun(run1);
    server.startRun(run1.id);

    const channel = await join(`run:${run1.id}`, { token: 'a.b.c' });
    channel.push(GET_PLAN).receive('ok', (run: Run) => {
      t.deepEqual(run, run1);
      done();
    });
  });
});

test.serial('complete an run through the run channel', async (t) => {
  return new Promise(async (done) => {
    const a = run1;
    server.registerRun(a);
    server.startRun(a.id);
    server.addDataclip('abc', { answer: 42 });

    const channel = await join(`run:${a.id}`, { token: 'a.b.c' });
    channel
      .push(RUN_COMPLETE, { reason: 'success', final_dataclip_id: 'abc' })
      .receive('ok', () => {
        const { pending, results } = server.getState();
        t.deepEqual(pending[a.id], {
          status: 'complete',
          logs: [],
          steps: {},
        });
        t.deepEqual(results[a.id].state, { answer: 42 });
        done();
      });
  });
});

test.serial('unsubscribe after run complete', async (t) => {
  return new Promise(async (done) => {
    const a = run1;
    server.registerRun(a);
    server.startRun(a.id);

    const channel = await join(`run:${a.id}`, { token: 'a.b.c' });
    channel.push(RUN_COMPLETE, { reason: 'success' }).receive('ok', () => {
      // After the complete event, the listener should unsubscribe to the channel
      // The mock will send an error to any unhandled events in that channel
      channel.push(RUN_COMPLETE).receive('error', () => {
        t.pass();
        done();
      });
    });
  });
});

test.serial('get credential through the run channel', async (t) => {
  return new Promise(async (done) => {
    server.startRun(run1.id);
    server.addCredential('a', credentials['a']);

    const channel = await join(`run:${run1.id}`, { token: 'a.b.c' });
    channel
      .push(GET_CREDENTIAL, { id: 'a' })
      .receive('ok', (result: Credential) => {
        t.deepEqual(result, credentials['a']);
        done();
      });
  });
});

test.serial('get dataclip through the run channel', async (t) => {
  return new Promise(async (done) => {
    server.startRun(run1.id);
    server.addDataclip('d', dataclips['d']);

    const channel = await join(`run:${run1.id}`, { token: 'a.b.c' });
    channel.push(GET_DATACLIP, { id: 'd' }).receive('ok', (result: any) => {
      const str = enc.decode(new Uint8Array(result));
      const dataclip = JSON.parse(str);
      t.deepEqual(dataclip, dataclips['d']);
      done();
    });
  });
});

// TODO test that all events are proxied out to server.on

test.serial(
  'waitForResult should return logs and dataclip when an run is completed',
  async (t) => {
    return new Promise(async (done) => {
      const result = { answer: 42 };

      server.startRun(run1.id);
      server.addDataclip('result', result);

      server.waitForResult(run1.id).then((dataclip: DataClip) => {
        t.deepEqual(result, dataclip);
        done();
      });

      const channel = await join(`run:${run1.id}`, { token: 'a.b.c' });
      channel.push(RUN_COMPLETE, {
        final_dataclip_id: 'result',
      } as RunCompletePayload);
    });
  }
);

// TODO this should probably return reason AND state?
test.serial(
  'getResult should return the correct resulting dataclip',
  async (t) => {
    return new Promise(async (done) => {
      const result = { answer: 42 };

      server.startRun(run1.id);
      server.addDataclip('result', result);

      server.waitForResult(run1.id).then(() => {
        const dataclip = server.getResult(run1.id);
        t.deepEqual(result, dataclip);
        done();
      });

      const channel = await join(`run:${run1.id}`, { token: 'a.b.c' });
      channel.push(RUN_COMPLETE, {
        final_dataclip_id: 'result',
      } as RunCompletePayload);
    });
  }
);

// test.serial('getLogs should return logs', async (t) => {});
