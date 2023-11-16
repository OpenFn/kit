import test from 'ava';
import { RUN_START } from '@openfn/ws-worker';

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
      job_id: 'a',
      run_id: 'r:a',
      input_dataclip_id: 'x',
    };

    const channel = await join(client, attempt.id);

    channel.push(RUN_START, event).receive('ok', () => {
      t.pass('event acknowledged');
      done();
    });
  });
});

test.serial('save run id to state', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      job_id: 'a',
      run_id: 'r:a',
      input_dataclip_id: 'x',
    };

    const channel = await join(client, attempt.id);

    channel.push(RUN_START, event).receive('ok', () => {
      t.deepEqual(server.state.pending[attempt.id].runs, {
        [event.job_id]: event.run_id,
      });
      done();
    });
  });
});

test.serial('error if no run_id', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      job_id: 'a',
      run_id: undefined,
      input_dataclip_id: 'x',
    };

    const channel = await join(client, attempt.id);

    channel.push(RUN_START, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});

test.serial('error if no job_id', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      job_id: undefined,
      run_id: 'r:a',
      input_dataclip_id: 'x',
    };

    const channel = await join(client, attempt.id);

    channel.push(RUN_START, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});

test.serial('error if no input_dataclip_id', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      job_id: 'a',
      run_id: 'r:a',
      input_dataclip_id: undefined,
    };

    const channel = await join(client, attempt.id);

    channel.push(RUN_START, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});
