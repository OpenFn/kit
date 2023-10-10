import test from 'ava';
import path from 'node:path';

import initWorkers, { createWorkers } from '../../src/api/call-worker';
import { EngineAPI } from '../../src/types';

let api = {} as EngineAPI;

test.before(() => {
  const workerPath = path.resolve('test/worker-functions.js');
  initWorkers(api, workerPath);
});

test('initWorkers should add a callWorker function', (t) => {
  t.assert(typeof api.callWorker === 'function');
});

test('callWorker should return the default result', async (t) => {
  const result = await api.callWorker('test');
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
