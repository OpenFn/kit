import test from 'ava';
import crypto from 'node:crypto';

import { setup } from '../util';
import { attempts } from '../data';
import { ATTEMPT_START } from '@openfn/ws-worker';

let server;
let client;

const port = 5555;

const attempt1 = attempts['attempt-1'];

type Channel = any; // TODO

test.before(async () => ({ server, client } = await setup(port)));

const createAttempt = () => ({
  ...attempt1,
  id: crypto.randomUUID(),
});

const join = (attemptId: string): Promise<Channel> =>
  new Promise((done, reject) => {
    const channel = client.channel(`attempt:${attemptId}`, { token: 'a.b.c' });
    channel
      .join()
      .receive('ok', () => {
        done(channel);
      })
      .receive('error', (err) => {
        reject(new Error(err));
      });
  });

test.serial('acknowledge attempt:start', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {};

    const channel = await join(attempt.id);

    channel.push(ATTEMPT_START, event).receive('ok', () => {
      t.pass('event acknowledged');
      done();
    });
  });
});

test.serial('reject attempt:start for an unknown attempt', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();
    const event = {};

    server.startAttempt(attempt.id);

    // Note that the mock is currently lenient here
    const channel = await join(attempt.id);

    // Sneak into the server and kill the state for this attempt
    delete server.state.pending[attempt.id];

    channel.push(ATTEMPT_START, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});

test.serial('reject attempt:start for a completed attempt', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();
    const event = {};

    server.startAttempt(attempt.id);

    // Note that the mock is currently lenient here
    const channel = await join(attempt.id);

    // Sneak into the server and update the state for this attempt
    server.state.pending[attempt.id].status = 'completed';

    channel.push(ATTEMPT_START, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});
