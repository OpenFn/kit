import test from 'ava';
import path from 'node:path';
import EventEmitter from 'node:events';
import { Promise as WorkerPoolPromise } from 'workerpool';

import initWorkers from '../../src/api/call-worker';
import { EngineAPI } from '../../src/types';
import { PURGE } from '../../src/events';

let api = new EventEmitter() as EngineAPI;

const workerPath = path.resolve('src/test/worker-functions.js');

test.before(() => {
  initWorkers(api, workerPath);
});

test.after(() => api.closeWorkers());

test.serial('initWorkers should add a callWorker function', (t) => {
  t.assert(typeof api.callWorker === 'function');
});

test.serial('callWorker should return the default result', async (t) => {
  const result = await api.callWorker('test', []);
  t.is(result, 42);
});

test.serial('callWorker should return a custom result', async (t) => {
  const result = await api.callWorker('test', [84]);
  t.is(result, 84);
});

test.serial('callWorker should trigger an event callback', async (t) => {
  return new Promise((done) => {
    const onCallback = ({ result }) => {
      t.is(result, 11);
      done();
    };

    api.callWorker('test', [11], { message: onCallback });
  });
});

test.serial(
  'callWorker should throw TimeoutError if it times out',
  async (t) => {
    await t.throwsAsync(() => api.callWorker('timeout', [11], {}, 10), {
      instanceOf: WorkerPoolPromise.TimeoutError,
    });
  }
);

// Dang, this doesn't work, the worker threads run in the same process
test.skip('callWorker should execute with a different process id', async (t) => {
  return new Promise((done) => {
    const onCallback = ({ pid }) => {
      t.not(process.pid, pid);
      done();
    };

    api.callWorker('test', [], { message: onCallback });
  });
});

test.serial('callWorker should execute in a different process', async (t) => {
  return new Promise((done) => {
    // @ts-ignore
    process.scribble = 'xyz';

    const onCallback = ({ scribble }) => {
      // @ts-ignore
      t.not(process.scribble, scribble);
      done();
    };

    api.callWorker('test', [], { message: onCallback });
  });
});

test.serial('callWorker should try to purge workers on complete', async (t) => {
  return new Promise((done) => {
    api.on(PURGE, () => {
      t.pass('purge event called');
      done();
    });

    api.callWorker('test', []);
  });
});

test.serial(
  'If null env is passed, worker thread should be able to access parent env',
  async (t) => {
    const badAPI = {} as EngineAPI;
    const env = null;
    initWorkers(badAPI, workerPath, { env });

    // Set up a special key on process.env
    const code = '76ytghjs';
    process.env.TEST = code;

    // try and read that key inside the thread
    const result = await badAPI.callWorker('readEnv', ['TEST']);

    // voila, the kingdom is yours
    t.is(result, code);

    badAPI.closeWorkers();
  }
);

test.serial(
  'By default, worker thread cannot access parent env if env not set (no options arg)',
  async (t) => {
    const defaultAPI = {} as EngineAPI;

    initWorkers(defaultAPI, workerPath /* no options passed*/);

    // Set up a special key on process.env
    const code = '76ytghjs';
    process.env.TEST = code;

    // try and read that key inside the thread
    const result = await defaultAPI.callWorker('readEnv', ['TEST']);

    // No fish
    t.is(result, undefined);

    defaultAPI.closeWorkers();
  }
);

test.serial(
  'By default, worker thread cannot access parent env if env not set (with options arg)',
  async (t) => {
    const defaultAPI = {} as EngineAPI;

    initWorkers(defaultAPI, workerPath, { maxWorkers: 1 });

    // Set up a special key on process.env
    const code = '76ytghjs';
    process.env.TEST = code;

    // try and read that key inside the thread
    const result = await defaultAPI.callWorker('readEnv', ['TEST']);

    // No fish
    t.is(result, undefined);

    defaultAPI.closeWorkers();
  }
);

test.serial(
  'Worker thread cannot access parent env if custom env is passted',
  async (t) => {
    const customAPI = {} as EngineAPI;
    const env = { NODE_ENV: 'production' };
    initWorkers(customAPI, workerPath, { env });

    // Set up a special key on process.env
    const code = '76ytghjs';
    process.env.TEST = code;

    // try and read that key inside the thread
    const result = await customAPI.callWorker('readEnv', ['TEST']);

    // No fish
    t.is(result, undefined);

    const result2 = await customAPI.callWorker('readEnv', ['NODE_ENV']);
    t.is(result2, 'production');

    customAPI.closeWorkers();
  }
);
