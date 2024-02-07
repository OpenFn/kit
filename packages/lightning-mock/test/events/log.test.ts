import test from 'ava';
import { RUN_LOG } from '../../src/events';

import { join, setup, createRun } from '../util';

let server: any;
let client: any;

const port = 5501;

test.before(async () => ({ server, client } = await setup(port)));

test.serial('acknowledge valid message (run log)', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();

    server.startRun(run.id);

    const event = {
      run_id: run.id,
      message: 'blah',
      level: 'info',
      source: 'R/T',
      timestamp: '123',
    };

    const channel = await join(client, run.id);

    channel.push(RUN_LOG, event).receive('ok', () => {
      t.pass('event acknowledged');
      done();
    });
  });
});

test.serial('acknowledge valid message (job log)', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();

    server.startRun(run.id);

    const event = {
      run_id: run.id,
      job_id: 'a',
      message: 'blah',
      level: 'info',
      source: 'R/T',
      timestamp: '123',
    };

    const channel = await join(client, run.id);

    channel.push(RUN_LOG, event).receive('ok', () => {
      t.pass('event acknowledged');
      done();
    });
  });
});

test.serial('save log to state', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();

    server.startRun(run.id);

    const event = {
      run_id: run.id,
      job_id: 'a',
      message: 'blah',
      level: 'info',
      source: 'R/T',
      timestamp: '123',
    };

    const channel = await join(client, run.id);

    channel.push(RUN_LOG, event).receive('ok', () => {
      const { pending } = server.getState();
      const [savedLog] = pending[run.id].logs;
      t.deepEqual(savedLog, event);
      done();
    });
  });
});

test.serial('error if no message', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();

    server.startRun(run.id);

    const event = {
      run_id: run.id,
      job_id: 'a',
      level: 'info',
      source: 'R/T',
      timestamp: '123',
    };
    const channel = await join(client, run.id);

    channel.push(RUN_LOG, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});

test.serial('error if no source', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();

    server.startRun(run.id);

    const event = {
      run_id: run.id,
      job_id: 'a',
      message: 'blah',
      level: 'info',
      timestamp: '123',
    };
    const channel = await join(client, run.id);

    channel.push(RUN_LOG, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});

test.serial('error if no timestamp', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();

    server.startRun(run.id);

    const event = {
      run_id: run.id,
      message: 'blah',
      level: 'info',
      source: 'R/T',
    };
    const channel = await join(client, run.id);

    channel.push(RUN_LOG, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});

test.serial('error if no level', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();

    server.startRun(run.id);

    const event = {
      run_id: run.id,
      job_id: 'a',
      message: 'blah',
      source: 'R/T',
      timestamp: '123',
    };
    const channel = await join(client, run.id);

    channel.push(RUN_LOG, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});
