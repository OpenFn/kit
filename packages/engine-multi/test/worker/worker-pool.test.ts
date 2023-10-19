import test from 'ava';
import workerpool from 'workerpool';

//some tests of worker stuff
let pool;

test.beforeEach(() => {
  pool = workerpool.pool({ maxWorkers: 1 });
});

test.afterEach(() => {
  pool.terminate();
});

test.serial('run an expression inside a worker', async (t) => {
  const fn = () => 42;

  const result = await pool.exec(fn, []);

  t.is(result, 42);
});

test.serial('worker should not have access to host globals', async (t) => {
  const pool = workerpool.pool({ maxWorkers: 1 });
  global.x = 22;

  const fn = () => global.x;

  const result = await pool.exec(fn, []);

  t.is(result, undefined);
  delete global.x;
});

test.serial('worker should not mutate host global scope', async (t) => {
  t.is(global.x, undefined);

  const fn = () => {
    global.x = 9;
  };

  await pool.exec(fn, []);

  t.is(global.x, undefined);
});

// fails! This is a problem
test.serial.skip('workers should not affect each other', async (t) => {
  t.is(global.x, undefined);

  const fn1 = () => {
    global.x = 9;
  };

  // Set a global inside the worker
  await pool.exec(fn1, []);

  // (should not affect us outside)
  t.is(global.x, undefined);

  const fn2 = () => global.x;

  // Call into the same worker and check the scope is still there
  const result = await pool.exec(fn2, []);

  // Fails - result is 9
  t.is(result, undefined);
});

// maybe flaky?
test.serial.skip(
  'workers should not affect each other if global scope is frozen',
  async (t) => {
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
