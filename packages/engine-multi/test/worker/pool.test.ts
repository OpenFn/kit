import test from 'ava';
import path from 'node:path';

import createPool from '../../src/worker/pool';

const workerPath = path.resolve('src/test/worker-functions.js');

test('create a pool with empty processes (5 by default)', (t) => {
  const pool = createPool('.');

  t.is(pool._pool.length, 5);
  t.true(pool._pool.every((f) => f === false));
});

test('create a pool with 10 empty processes', (t) => {
  const pool = createPool('.', { capacity: 10 });

  t.is(pool._pool.length, 10);
  t.true(pool._pool.every((f) => f === false));
});

test('run a task and return the result', async (t) => {
  const pool = createPool(workerPath);
  const result = await pool.exec('test', []);
  t.is(result, 42);
});

test('task runs inside a different process id', async (t) => {
  const pool = createPool(workerPath);
  const parentPid = process.pid;

  const childPid = await pool.exec('threadId', []);

  t.log('parent pid: ', parentPid);
  t.log('child pid: ', childPid);

  t.truthy(parentPid);
  t.truthy(childPid);
  t.not(parentPid, childPid);
});

test('Remove a worker from the pool and release it when finished', async (t) => {
  const pool = createPool(workerPath);

  t.is(pool._pool.length, 5);
  const p = pool.exec('test', []);
  t.is(pool._pool.length, 4);
  return p.then(() => {
    t.is(pool._pool.length, 5);

    // the first thing in the queue should be a worker
    t.true(pool[0] !== false);
  });
});

test('run a wait task', async (t) => {
  const pool = createPool(workerPath);
  await pool.exec('wait', []);
  t.pass();
});

test('add tasks to a queue if the pool is empty', async (t) => {
  const pool = createPool(workerPath, { capacity: 1 });
  t.is(pool._pool.length, 1);

  const p1 = pool.exec('wait', []);
  t.is(pool._queue.length, 0);
  t.is(pool._pool.length, 0);

  const p2 = pool.exec('wait', []);
  t.is(pool._queue.length, 1);
  t.is(pool._pool.length, 0);

  await Promise.all([p1, p2]);

  t.is(pool._queue.length, 0);
  t.is(pool._pool.length, 1);
});

test('run through a queue of tasks', async (t) => {
  const count = 30;
  const capacity = 10;

  const pool = createPool(workerPath, { capacity: capacity });
  t.is(pool._queue.length, 0);
  t.is(pool._pool.length, capacity);

  const queue = new Array(count).map(() => pool.exec('wait', [20]));

  const results = await Promise.all(queue);

  t.is(results.length, count);
  t.is(pool._queue.length, 0);
  t.is(pool._pool.length, capacity);
});
