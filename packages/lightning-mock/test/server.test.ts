// Tests of the lightning websever
import test from 'ava';
import createLightningServer from '../src/server';

import { Socket } from 'phoenix';
import { WebSocket } from 'ws';

import type { Attempt } from '../src/types';

let server;
let client;

const port = 3333;

const endpoint = `ws://localhost:${port}/worker`;

// Set up a lightning server and a phoenix socket client before each test
test.before(
  () =>
    new Promise((done) => {
      server = createLightningServer({ port });

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

test.serial('should setup an attempt at /POST /attempt', async (t) => {
  const state = server.getState();

  t.is(Object.keys(state.credentials).length, 0);
  t.is(Object.keys(state.attempts).length, 0);
  t.is(Object.keys(state.attempts).length, 0);

  const attempt: Attempt = {
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
      },
    ],
    edges: [],
  };

  await fetch(`http://localhost:${port}/attempt`, {
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
  return new Promise(async (done, reject) => {
    const channel = client.channel('x', {});

    channel.join().receive('ok', (res) => {
      t.is(res, 'ok');
      done();
    });
  });
});
