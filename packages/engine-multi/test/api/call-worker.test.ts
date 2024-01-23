import test from 'ava';
import path from 'node:path';
import EventEmitter from 'node:events';
import { createMockLogger } from '@openfn/logger';

import initWorkers from '../../src/api/call-worker';
import { EngineAPI } from '../../src/types';

let engine = new EventEmitter() as EngineAPI;

const workerPath = path.resolve('dist/test/worker-functions.js');
const logger = createMockLogger();

test.before(() => {
  const { callWorker, closeWorkers } = initWorkers(workerPath, {}, logger);
  engine.callWorker = callWorker;
  engine.closeWorkers = closeWorkers;
});

test.after(() => engine.closeWorkers());

test.serial('initWorkers should add a callWorker function', (t) => {
  t.assert(typeof engine.callWorker === 'function');
});

test.serial('callWorker should return the default result', async (t) => {
  const result = await engine.callWorker('test', []);
  t.is(result, 42);
});

test.serial('callWorker should return a custom result', async (t) => {
  const result = await engine.callWorker('test', [84]);
  t.is(result, 84);
});

test.serial('callWorker should trigger an event callback', async (t) => {
  return new Promise((done) => {
    const onCallback = ({ result }) => {
      t.is(result, 11);
      done();
    };

    engine.callWorker('test', [11], { 'test-message': onCallback });
  });
});

// TODO Important: the throw here causes the channel to close,
// stopping other tests from running. Must investigate
// it should have no side effects!
test.serial.skip(
  'callWorker should throw TimeoutError if it times out',
  async (t) => {
    await t.throwsAsync(() => engine.callWorker('timeout', [11], {}, 10), {
      name: 'TimeoutError',
    });
  }
);

test.serial(
  'callWorker should execute with a different process id',
  async (t) => {
    return new Promise((done) => {
      const onCallback = ({ pid }) => {
        t.not(process.pid, pid);
        done();
      };

      engine.callWorker('test', [], { 'test-message': onCallback });
    });
  }
);

// TODO this fails with others, but passes standalone
test.serial('callWorker should execute in a different process', async (t) => {
  return new Promise((done) => {
    // @ts-ignore
    process.scribble = 'xyz';

    const onCallback = ({ scribble }) => {
      // @ts-ignore
      t.not(process.scribble, scribble);
      done();
    };

    engine.callWorker('test', [], { 'test-message': onCallback });
  });
});

test.serial(
  'Even if null env is passed, worker thread should not be able to access parent env',
  async (t) => {
    const env = null;
    const { callWorker, closeWorkers } = initWorkers(
      workerPath,
      {
        env,
      },
      logger
    );

    // Set up a special key on process.env
    const code = '76ytghjs';
    process.env.TEST = code;

    // try and read that key inside the thread
    const result = await callWorker('readEnv', ['TEST']);

    // Sorry pal, no dice
    t.not(result, code);

    closeWorkers();
  }
);

test.serial(
  'By default, worker thread cannot access parent env if env not set (no options arg)',
  async (t) => {
    const { callWorker, closeWorkers } = initWorkers(
      workerPath,
      undefined,
      logger
    );

    // Set up a special key on process.env
    const code = '76ytghjs';
    process.env.TEST = code;

    // try and read that key inside the thread
    const result = await callWorker('readEnv', ['TEST']);

    // No fish
    t.is(result, undefined);

    closeWorkers();
  }
);

test.serial(
  'By default, worker thread cannot access parent env if env not set (with options arg)',
  async (t) => {
    const defaultAPI = {} as EngineAPI;

    const { callWorker, closeWorkers } = initWorkers(
      workerPath,
      { maxWorkers: 1 },
      logger
    );

    // Set up a special key on process.env
    const code = '76ytghjs';
    process.env.TEST = code;

    // try and read that key inside the thread
    const result = await callWorker('readEnv', ['TEST']);

    // No fish
    t.is(result, undefined);

    closeWorkers();
  }
);

test.serial(
  'Worker thread cannot access parent env if custom env is passted',
  async (t) => {
    const env = { NODE_ENV: 'production' };
    const { callWorker, closeWorkers } = initWorkers(
      workerPath,
      { env },
      logger
    );

    // Set up a special key on process.env
    const code = '76ytghjs';
    process.env.TEST = code;

    // try and read that key inside the thread
    const result = await callWorker('readEnv', ['TEST']);

    // No fish
    t.is(result, undefined);

    const result2 = await callWorker('readEnv', ['NODE_ENV']);
    t.is(result2, 'production');

    closeWorkers();
  }
);
