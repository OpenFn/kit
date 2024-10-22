// Tests of the lightning websever
import test from 'ava';
import { Socket } from 'phoenix';
import { WebSocket } from 'ws';
import type { LightningPlan } from '@openfn/lexicon/lightning';

import { setup } from './util';

let server: any;
let client: any;

const port = 3333;

const endpoint = `ws://localhost:${port}/worker`;

test.before(async () => ({ server, client } = await setup(port)));

test.serial('should setup an run at /POST /run', async (t) => {
  const state = server.getState();

  t.is(Object.keys(state.credentials).length, 0);
  t.is(Object.keys(state.runs).length, 0);
  t.is(Object.keys(state.runs).length, 0);

  const run: LightningPlan = {
    id: 'a',
    dataclip_id: 'a',
    starting_node_id: 'j',
    triggers: [],
    jobs: [
      {
        id: 'j',
        body: 'abc',
        credential: {
          // this will be converted into a string for lazy loading
          user: 'john',
          password: 'rambo',
        },
        adaptor: 'abc',
      },
    ],
    edges: [],
  };

  await fetch(`http://localhost:${port}/run`, {
    method: 'POST',
    body: JSON.stringify(run),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  const newState = server.getState();
  t.is(Object.keys(newState.runs).length, 1);
  const a = server.getRun('a');
  t.truthy(a);
  t.is(server.getQueueLength(), 1);

  t.is(Object.keys(newState.credentials).length, 1);

  const job = a.jobs[0];
  t.assert(typeof job.credential === 'string');
  const c = server.getCredential(job.credential);
  t.is(c.user, 'john');
});

test.serial('provide a phoenix websocket at /worker', (t) => {
  // client should be connected before this test runs
  t.is(client.connectionState(), 'open');
});

test.serial('reject ws connections without a token', (t) => {
  return new Promise((done) => {
    // client should be connected before this test runs
    const socket = new Socket(endpoint, { transport: WebSocket });
    socket.onClose(() => {
      t.pass();
      done();
    });
    socket.connect();
  });
});

test.serial('respond to channel join requests', (t) => {
  return new Promise(async (done) => {
    const channel = client.channel('x', {});

    channel.join().receive('ok', (res: any) => {
      t.is(res, 'ok');
      done();
    });
  });
});
