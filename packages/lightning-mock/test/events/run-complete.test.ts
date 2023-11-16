import test from 'ava';
import { RUN_COMPLETE } from '@openfn/ws-worker';

import { join, setup, createAttempt } from '../util';

let server;
let client;

const port = 5501;

test.before(async () => ({ server, client } = await setup(port)));

test.serial('acknowledge valid message', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      reason: 'success',
      output_dataclip: JSON.stringify({ x: 22 }),
      output_dataclip_id: 't',
    };

    const channel = await join(client, attempt.id);

    channel.push(RUN_COMPLETE, event).receive('ok', (evt) => {
      t.pass('event acknowledged');
      done();
    });
  });
});

test.serial('save dataclip id to state', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      reason: 'success',
      output_dataclip: JSON.stringify({ x: 22 }),
      output_dataclip_id: 't',
    };

    const channel = await join(client, attempt.id);

    channel.push(RUN_COMPLETE, event).receive('ok', () => {
      t.deepEqual(server.state.dataclips.t, JSON.parse(event.output_dataclip));
      done();
    });
  });
});

test.serial('error if no dataclip', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      reason: 'success',
      output_dataclip: null,
      output_dataclip_id: 't',
    };
    const channel = await join(client, attempt.id);

    channel.push(RUN_COMPLETE, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});

test.serial('error if no dataclip_d', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      reason: 'success',
      output_dataclip: JSON.stringify({ x: 22 }),
      output_dataclip_id: undefined,
    };
    const channel = await join(client, attempt.id);

    channel.push(RUN_COMPLETE, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});

test.serial('error if no reason', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      reason: undefined,
      output_dataclip: JSON.stringify({ x: 22 }),
      output_dataclip_id: undefined,
    };
    const channel = await join(client, attempt.id);

    channel.push(RUN_COMPLETE, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});

// reason validation code is shared with attempt:complete
// It's fine not to test further here
