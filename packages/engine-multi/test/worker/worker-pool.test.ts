import path from 'node:path';
import test from 'ava';
import v8 from 'v8';
import workerpool from 'workerpool';

const workerPath = path.resolve('src/test/worker-functions.js');

let pool;

const createPool = () => workerpool.pool({ maxWorkers: 1 });

// note that a dedicated pool does not allow arbitrary code execution
const createDedicatedPool = (opts = {}) =>
  workerpool.pool(workerPath, { maxWorkers: 1, ...opts });

test.afterEach(() => pool.terminate(true));

test.serial('run an expression inside a worker', async (t) => {
  pool = createPool();

  const fn = () => 42;

  const result = await pool.exec(fn, []);

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

// This is only true by default and is easily overridable
test.serial('thread has access to parent env', async (t) => {
  pool = createDedicatedPool();

  process.env.TEST = 'foobar';

  const result = await pool.exec('readEnv', ['TEST']);

  t.is(result, 'foobar');

  delete process.env.TEST;
});

test.serial('parent env can be hidden from thread', async (t) => {
  pool = createDedicatedPool({
    workerThreadOpts: {
      env: { PRIVATE: 'xyz' },
    },
  });

  process.env.TEST = 'foobar';

  const result = await pool.exec('readEnv', ['TEST']);
  t.is(result, undefined);

  const result2 = await pool.exec('readEnv', ['PRIVATE']);
  t.is(result2, 'xyz');

  delete process.env.TEST;
});

test.serial('worker should not have access to host globals', async (t) => {
  pool = createPool();
  global.x = 22;

  const fn = () => global.x;

  const result = await pool.exec(fn, []);

  t.is(result, undefined);
  delete global.x;
});

test.serial('worker should not mutate host global scope', async (t) => {
  pool = createPool();

  t.is(global.x, undefined);

  const fn = () => {
    global.x = 9;
  };

  await pool.exec(fn, []);

  t.is(global.x, undefined);
});

// This is potentially a security concern for jobs which escape the runtime sandbox
test.serial('workers share a global scope', async (t) => {
  pool = createPool();

  t.is(global.x, undefined);

  const fn1 = () => {
    global.x = 9;
  };

  // Set a global inside the worker
  await pool.exec(fn1, []);

  // (should not affect us outside)
  t.is(global.x, undefined);

  const fn2 = () => global.x;

  // Call into the same worker and reads the global scope again
  const result = await pool.exec(fn2, []);

  // And yes, the internal global x has a value of 9
  t.is(result, 9);
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

test.serial('worker should die if it blows the memory limit', async (t) => {
  pool = createDedicatedPool({
    workerThreadOpts: {
      // Note for the record that these limits do NOT include arraybuffers
      resourceLimits: {
        // These are values I can set

        // And I think this is the one I care about:
        // The maximum size of the main heap in MB.
        // Note that this needs to be at least like 200mb to not blow up in test
        maxOldGenerationSizeMb: 100,

        // // The maximum size of a heap space for recently created objects.
        // maxYoungGenerationSizeMb: 10,

        // // The size of a pre-allocated memory range used for generated code.
        // codeRangeSizeMb: 20,

        // The default maximum stack size for the thread. Small values may lead to unusable Worker instances. Default: 4
        // stackSizeMb: 4,
      },
    },
  });

  await t.throwsAsync(() => pool.exec('blowMemory', []), {
    code: 'ERR_WORKER_OUT_OF_MEMORY',
    message:
      'Worker terminated due to reaching memory limit: JS heap out of memory',
  });
});

test.todo('threads should all have the same rss memory');
