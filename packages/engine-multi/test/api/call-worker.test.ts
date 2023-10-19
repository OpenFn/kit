import test from 'ava';
import path from 'node:path';

import initWorkers, { createWorkers } from '../../src/api/call-worker';
import { EngineAPI } from '../../src/types';

let api = {} as EngineAPI;

const workerPath = path.resolve('src/test/worker-functions.js');

test.before(() => {
  initWorkers(api, workerPath);
});

// TODO should I be tearing down the pool each time?

test('initWorkers should add a callWorker function', (t) => {
  t.assert(typeof api.callWorker === 'function');
});

test('callWorker should return the default result', async (t) => {
  const result = await api.callWorker('test', []);
  t.is(result, 42);
});

test('callWorker should return a custom result', async (t) => {
  const result = await api.callWorker('test', [84]);
  t.is(result, 84);
});

test('callWorker should trigger an event callback', async (t) => {
  return new Promise((done) => {
    const onCallback = ({ result }) => {
      t.is(result, 11);
      done();
    };

    api.callWorker('test', [11], { message: onCallback });
  });
});

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

test('callWorker should execute in a different process', async (t) => {
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

test('If no env is passed, worker thread should be able to access parent env', async (t) => {
  const badAPI = {} as EngineAPI;
  initWorkers(badAPI, workerPath, null!);

  // Set up a special key on process.env
  const code = '76ytghjs';
  process.env.TEST = code;

  // try and read that key inside the thread
  const result = await badAPI.callWorker('readEnv', ['TEST']);

  // voila
  t.is(result, code);
});

test('By default, worker thread cannot access parent env if env not set', async (t) => {
  const defaultAPI = {} as EngineAPI;
  initWorkers(defaultAPI, workerPath, undefined);

  // Set up a special key on process.env
  const code = '76ytghjs';
  process.env.TEST = code;

  // try and read that key inside the thread
  const result = await defaultAPI.callWorker('readEnv', ['TEST']);

  // No fish
  t.is(result, undefined);
});

test('Worker thread cannot access parent env if custom env is passted', async (t) => {
  const customAPI = {} as EngineAPI;
  initWorkers(customAPI, workerPath, { NODE_ENV: 'production' });

  // Set up a special key on process.env
  const code = '76ytghjs';
  process.env.TEST = code;

  // try and read that key inside the thread
  const result = await customAPI.callWorker('readEnv', ['TEST']);

  // No fish
  t.is(result, undefined);

  const result2 = await customAPI.callWorker('readEnv', ['NODE_ENV']);
  t.is(result2, 'production');
});
