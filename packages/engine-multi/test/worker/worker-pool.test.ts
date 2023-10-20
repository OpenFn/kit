import path from 'node:path';
import test from 'ava';
import workerpool from 'workerpool';

const workerPath = path.resolve('src/test/worker-functions.js');

let pool;

const createPool = () => workerpool.pool({ maxWorkers: 1 });
const createPoolWithFunctions = () =>
  workerpool.pool(workerPath, { maxWorkers: 1 });

test.afterEach(() => pool.terminate());

test.serial('run an expression inside a worker', async (t) => {
  pool = createPool();

  const fn = () => 42;

  const result = await pool.exec(fn, []);

  t.is(result, 42);
});

test.serial('expressions should have the same threadId', async (t) => {
  pool = createPoolWithFunctions();

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

test.serial(
  'workers should not affect each other if global scope is frozen',
  async (t) => {
    pool = createPool();

    t.is(global.x, undefined);

    const fn1 = () => {
      Object.freeze(global);
      global.x = 9;
    };

    // Set a global inside the worker
    await pool.exec(fn1, []);

    // (should not affect us outside)
    t.is(global.x, undefined);

    const fn2 = () => global.x;

    // Call into the same worker and check the scope is still there
    const result = await pool.exec(fn2, []);

    t.is(result, undefined);
  }
);

// test imports inside the worker
// this is basically testing that imported modules do not get re-intialised
test.serial('static imports should share state across runs', async (t) => {
  pool = createPoolWithFunctions();

  const count1 = await pool.exec('incrementStatic', []);
  t.is(count1, 1);

  const count2 = await pool.exec('incrementStatic', []);
  t.is(count2, 2);

  const count3 = await pool.exec('incrementStatic', []);
  t.is(count3, 3);
});

test.serial('dynamic imports should share state across runs', async (t) => {
  pool = createPoolWithFunctions();

  const count1 = await pool.exec('incrementDynamic', []);
  t.is(count1, 1);

  const count2 = await pool.exec('incrementDynamic', []);
  t.is(count2, 2);

  const count3 = await pool.exec('incrementDynamic', []);
  t.is(count3, 3);
});
