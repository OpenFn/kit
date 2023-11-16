import test from 'ava';
import { ATTEMPT_LOG } from '../../src/events';

import { join, setup, createAttempt } from '../util';

let server;
let client;

const port = 5501;

test.before(async () => ({ server, client } = await setup(port)));

test.serial('acknowledge valid message (attempt log)', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      attempt_id: attempt.id,
      message: 'blah',
      level: 'info',
      source: 'R/T',
      timestamp: '123',
    };

    const channel = await join(client, attempt.id);

    channel.push(ATTEMPT_LOG, event).receive('ok', (evt) => {
      t.pass('event acknowledged');
      done();
    });
  });
});

test.serial('acknowledge valid message (job log)', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      attempt_id: attempt.id,
      job_id: 'a',
      message: 'blah',
      level: 'info',
      source: 'R/T',
      timestamp: '123',
    };

    const channel = await join(client, attempt.id);

    channel.push(ATTEMPT_LOG, event).receive('ok', (evt) => {
      t.pass('event acknowledged');
      done();
    });
  });
});

test.serial('save log to state', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      attempt_id: attempt.id,
      job_id: 'a',
      message: 'blah',
      level: 'info',
      source: 'R/T',
      timestamp: '123',
    };

    const channel = await join(client, attempt.id);

    channel.push(ATTEMPT_LOG, event).receive('ok', () => {
      const { pending } = server.getState();
      const [savedLog] = pending[attempt.id].logs;
      t.deepEqual(savedLog, event);
      done();
    });
  });
});

test.serial('error if no message', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      attempt_id: attempt.id,
      job_id: 'a',
      level: 'info',
      source: 'R/T',
      timestamp: '123',
    };
    const channel = await join(client, attempt.id);

    channel.push(ATTEMPT_LOG, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});

test.serial('error if no source', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      attempt_id: attempt.id,
      job_id: 'a',
      message: 'blah',
      level: 'info',
      timestamp: '123',
    };
    const channel = await join(client, attempt.id);

    channel.push(ATTEMPT_LOG, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});

test.serial('error if no timestamp', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      attempt_id: attempt.id,
      message: 'blah',
      level: 'info',
      source: 'R/T',
    };
    const channel = await join(client, attempt.id);

    channel.push(ATTEMPT_LOG, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});

test.serial('error if no level', async (t) => {
  return new Promise(async (done) => {
    const attempt = createAttempt();

    server.startAttempt(attempt.id);

    const event = {
      attempt_id: attempt.id,
      job_id: 'a',
      message: 'blah',
      source: 'R/T',
      timestamp: '123',
    };
    const channel = await join(client, attempt.id);

    channel.push(ATTEMPT_LOG, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});
