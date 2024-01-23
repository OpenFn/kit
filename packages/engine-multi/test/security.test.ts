/**
 * These tests run code in the engine and demonstate
 * the natural sandboxing provided by our architecture
 *
 * These do NOT use the runtime engine or the runtime sandbox
 */

import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';
import createEngine from '../src/engine';

const logger = createMockLogger('', { level: 'debug' });

const options = {
  logger,
  env: { PRIVATE: 'xyz' },
  repoDir: '.',
  // Important: ensure there's only one child process in the pool for these tests
  maxWorkers: 1,
};

let engine;

test.before(async () => {
  engine = await createEngine(
    options,
    path.resolve('dist/test/worker-functions.js')
  );
});

test.afterEach(async () => {
  logger._reset();
});

test.serial('parent env is hidden from sandbox', async (t) => {
  // Note that these use the underlying callworker function,
  // not execute
  const result2 = await engine.callWorker('readEnv', ['PRIVATE']);
  t.falsy(result2, 'xyz');

  delete process.env.TEST;
});

test.serial('sandbox does not share a global scope', async (t) => {
  t.is(global.x, undefined);

  // Set a global inside the first task
  await engine.callWorker('setGlobalX', [9]);

  // (this should not affect us outside)
  t.is(global.x, undefined);

  // the next task should not be able to read that value
  const result = await engine.callWorker('getGlobalX', []);
  t.falsy(result);
});

test.serial(
  'statically imported modules should isolate scope and state across runs',
  async (t) => {
    const count1 = await engine.callWorker('incrementStatic', []);
    t.is(count1, 1);

    const count2 = await engine.callWorker('incrementStatic', []);
    t.is(count2, 1);

    const count3 = await engine.callWorker('incrementStatic', []);
    t.is(count3, 1);
  }
);

test.serial(
  'dynamically imported modules should isolate scope and state across runs',
  async (t) => {
    const count1 = await engine.callWorker('incrementDynamic', []);
    t.is(count1, 1);

    const count2 = await engine.callWorker('incrementDynamic', []);
    t.is(count2, 1);

    const count3 = await engine.callWorker('incrementDynamic', []);
    t.is(count3, 1);
  }
);
