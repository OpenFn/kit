import test from 'ava';

import { join, setup, createAttempt } from '../util';
import { ATTEMPT_START } from '@openfn/ws-worker';

let server;
let client;

const port = 5500;

test.before(async () => ({ server, client } = await setup(port)));

test.serial('acknowledge attempt:start', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {};

    const channel = await join(client, attempt.id);

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
    const channel = await join(client, attempt.id);

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
    const channel = await join(client, attempt.id);

    // Sneak into the server and update the state for this attempt
    server.state.pending[attempt.id].status = 'completed';

    channel.push(ATTEMPT_START, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});
