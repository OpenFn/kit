// TODO what do I do with this? Some tests are useful
// some are security minded
import path from 'node:path';
import test from 'ava';
import v8 from 'v8';

// These tests should all pass against the new pool implementation
// But to simplify the tests we should merge them into one file, or generally reorganise
// import workerpool from 'workerpool';
import actualCreatePool from '../../src/worker/pool';

const workerPath = path.resolve('dist/test/worker-functions.js');

let pool;

// note that a dedicated pool does not allow arbitrary code execution
const createDedicatedPool = (opts = {}) =>
  actualCreatePool(workerPath, { maxWorkers: 1, ...opts });

// The dedicated thing doesn't matter anymore
// TODO simplify all this
const createPool = createDedicatedPool;

test.afterEach(() => pool.destroy(true));

test.serial('run an expression inside a worker', async (t) => {
  pool = createPool();

  const result = await pool.exec('test', []);

  t.is(result, 42);
});

test.serial('expressions should have the same threadId', async (t) => {
  pool = createDedicatedPool();

  const ids = {};

  const saveThreadId = (id: string) => {
    if (!ids[id]) {
      ids[id] = 0;
    }
    ids[id]++;
  };

  // Run 4 jobs and return the threadId for each
  // With only one worker thread they should all be the same
  await Promise.all([
    pool.exec('threadId', []).then(saveThreadId),
    pool.exec('threadId', []).then(saveThreadId),
    pool.exec('threadId', []).then(saveThreadId),
    pool.exec('threadId', []).then(saveThreadId),
  ]);

  const allUsedIds = Object.keys(ids);

  t.is(allUsedIds.length, 1);
  t.is(ids[allUsedIds[0]], 4);
});

test.serial('parent env can be hidden from thread', async (t) => {
  pool = createDedicatedPool({
    env: { PRIVATE: 'xyz' },
  });

  process.env.TEST = 'foobar';

  const result = await pool.exec('readEnv', ['TEST']);
  t.is(result, undefined);

  const result2 = await pool.exec('readEnv', ['PRIVATE']);
  t.is(result2, 'xyz');

  delete process.env.TEST;
});

test.serial('get/set global x', async (t) => {
  pool = createDedicatedPool();

  await pool.exec('setGlobalX', [11]);
  const result = await pool.exec('getGlobalX');

  t.is(result, 11);
});

test.serial('get/set global error', async (t) => {
  pool = createDedicatedPool();

  await pool.exec('writeToGlobalError', [{ y: 222 }]);
  const result = await pool.exec('getFromGlobalError', ['y']);

  t.is(result, 222);
});

// The pool should behave EXACTLY like workerpool with this stuff
// because successive tasks run in the same environment
// It's not until we thread the execute task that it improves
test.serial('workers share a global scope', async (t) => {
  pool = createPool();

  t.is(global.x, undefined);

  // Set a global inside the worker
  await pool.exec('setGlobalX', [9]);

  // (should not affect us outside)
  t.is(global.x, undefined);

  // Call into the same worker and reads the global scope again
  const result = await pool.exec('getGlobalX', []);

  // And yes, the internal global x has a value of 9
  t.is(result, 9);
});

test.serial('freeze prevents global scope being mutated', async (t) => {
  pool = createDedicatedPool();

  // Freeze the scope
  await pool.exec('freeze', []);

  t.is(global.x, undefined);

  await t.throwsAsync(pool.exec('setGlobalX', [11]), {
    message: 'Cannot add property x, object is not extensible',
  });
});

test.serial('freeze does not prevent global Error being mutated', async (t) => {
  pool = createDedicatedPool();

  // Freeze the scope
  await pool.exec('freeze', []);

  t.is(global.x, undefined);

  await pool.exec('writeToGlobalError', [{ y: 222 }]);
  const result = await pool.exec('getFromGlobalError', ['y']);

  t.is(result, 222);
});

// test imports inside the worker
// this is basically testing that imported modules do not get re-intialised
test.serial('static imports should share state across runs', async (t) => {
  pool = createDedicatedPool();

  const count1 = await pool.exec('incrementStatic', []);
  t.is(count1, 1);

  const count2 = await pool.exec('incrementStatic', []);
  t.is(count2, 2);

  const count3 = await pool.exec('incrementStatic', []);
  t.is(count3, 3);
});

test.serial('dynamic imports should share state across runs', async (t) => {
  pool = createDedicatedPool();

  const count1 = await pool.exec('incrementDynamic', []);
  t.is(count1, 1);

  const count2 = await pool.exec('incrementDynamic', []);
  t.is(count2, 2);

  const count3 = await pool.exec('incrementDynamic', []);
  t.is(count3, 3);
});

// This is kinda done in the tests above, it's just to setup the next test
test.serial('module scope is shared within a thread', async (t) => {
  pool = createDedicatedPool({ maxWorkers: 1 });

  const result = await Promise.all([
    pool.exec('incrementDynamic', []),
    pool.exec('incrementDynamic', []),
    pool.exec('incrementDynamic', []),
  ]);

  t.deepEqual(result, [1, 2, 3]);
});

test.serial('module scope is isolated across threads', async (t) => {
  pool = createDedicatedPool({ maxWorkers: 3 });

  const result = await Promise.all([
    pool.exec('incrementDynamic', []),
    pool.exec('incrementDynamic', []),
    pool.exec('incrementDynamic', []),
  ]);

  t.deepEqual(result, [1, 1, 1]);
});

// TODO need to work out how to enforce this one in the pool
test.serial.skip(
  'worker should die if it blows the memory limit',
  async (t) => {
    pool = createDedicatedPool({
      // See resourceLimits for more docs
      // Note for the record that these limits do NOT include arraybuffers
      resourceLimits: {
        // This is basically heap size
        // Note that this needs to be at least like 200mb to not blow up in test
        maxOldGenerationSizeMb: 100,
      },
    });

    await t.throwsAsync(() => pool.exec('blowMemory', []), {
      code: 'ERR_WORKER_OUT_OF_MEMORY',
      message:
        'Worker terminated due to reaching memory limit: JS heap out of memory',
    });
  }
);

test.todo('threads should all have the same rss memory');
