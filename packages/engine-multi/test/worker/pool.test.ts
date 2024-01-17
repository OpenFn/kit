import test from 'ava';
import path from 'node:path';

import createPool from '../../src/worker/pool';

const workerPath = path.resolve('dist/test/worker-functions.js');

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

test('run a task with arguments and return the result', async (t) => {
  const pool = createPool(workerPath);
  const result = await pool.exec('test', [22]);
  t.is(result, 22);
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

test('add tasks with args to a queue if the pool is empty', async (t) => {
  const pool = createPool(workerPath, { capacity: 1 });
  t.is(pool._pool.length, 1);

  const p1 = pool.exec('wait', []);
  t.is(pool._queue.length, 0);
  t.is(pool._pool.length, 0);

  const p2 = pool.exec('test', [11]);
  t.is(pool._queue.length, 1);
  t.is(pool._pool.length, 0);

  const [_r1, r2] = await Promise.all([p1, p2]);

  t.is(r2, 11);
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

// This might be a bit of an artificial test
// because the actual inner runtime should never throw
test('throw if the task throws', async (t) => {
  const pool = createPool(workerPath);

  try {
    await pool.exec('throw', []);
  } catch (e) {
    // NB e is not an error isntance
    t.is(e.message, 'test_error');
  }
});

test('destroy should handle un-initialised workers', async (t) => {
  const pool = createPool(workerPath, { capacity: 10 });
  pool.destroy();
  t.is(pool._pool.length, 0);
});

test('destroy should close all child processes', async (t) => {
  // warm up a pool
  const pool = createPool(workerPath, { capacity: 10 });

  const queue = new Array(10).fill(true).map(() => pool.exec('test'));
  await Promise.all(queue);

  const workers = Object.values(pool._allWorkers);

  // now destroy it
  pool.destroy();

  // check that every child is disconnected
  t.true(workers.every((child) => child.killed));

  // the pool should be empty
  t.is(pool._pool.length, 0);
});

test('destroy gracefully', (t) => {
  return new Promise((done) => {
    const pool = createPool(workerPath);
    const workers = Object.values(pool._allWorkers);

    t.is(pool._pool.length, 5);

    pool.exec('wait', [100]).then((result) => {
      t.is(result, 1);
      setTimeout(() => {
        t.true(workers.every((child) => child.killed));
        t.is(pool._pool.length, 0);

        done();
      }, 1);
    });

    pool.destroy();

    t.is(pool._pool.length, 0);
  });
});

// TODO should the worker throw on sigterm?
test('destroy immediately', (t) => {
  return new Promise((done) => {
    const pool = createPool(workerPath);

    t.is(pool._pool.length, 5);

    // this should not return
    pool
      .exec('wait', [100])
      .then(() => {
        t.fail('Task should not have returned!');
      })
      .catch((e) => {
        // TODO the pool currnetly throws an ExitError if it is interrupted
        // Is this correct?
        t.log(e);
        // console.log(e);
      });

    pool.destroy(true);

    t.is(pool._pool.length, 0);

    setTimeout(() => {
      t.pass();
      done();
    }, 1000); // not sure why but this needs to be quite a long delay
  });
});

// TODO is this right?
// If we've claimed and the claimed attempt is waiting, we should probably run it
// so this is invalid
test.skip("don't process the queue after destroy", () => {
  const pool = createPool(workerPath, { capacity: 1 });

  pool.exec('wait', [100]);
  pool.exec('wait', [100]);
});

test('throw on exec if destroyed', (t) => {
  const pool = createPool(workerPath);

  t.is(pool._pool.length, 5);

  pool.destroy(true);

  t.throws(() => pool.exec('test'), {
    message: 'Worker destroyed',
  });
});

test('listen to an event', async (t) => {
  const pool = createPool(workerPath);

  await pool.exec('test', [20], {
    on: (evt) => {
      if (evt.type === 'test-message') {
        t.log(evt);
        t.pass();
      }
    },
  });
});

test('listen to an event in two successive tasks', async (t) => {
  const pool = createPool(workerPath, { capacity: 1 });

  let count = 0;

  await pool.exec('test', [20], {
    on: (evt) => {
      if (evt.type === 'test-message') {
        count++;
      }
    },
  });

  await pool.exec('test', [20], {
    on: (evt) => {
      if (evt.type === 'test-message') {
        count++;
      }
    },
  });

  t.is(count, 2);
});

test('listen to an event in two successive tasks after a queue', async (t) => {
  return new Promise((done) => {
    const pool = createPool(workerPath, { capacity: 1 });

    let count = 0;

    pool.exec('test', [20], {
      on: (evt) => {
        if (evt.type === 'test-message') {
          count++;
        }
      },
    });

    pool
      .exec('test', [20], {
        on: (evt) => {
          if (evt.type === 'test-message') {
            count++;
          }
        },
      })
      .then(() => {
        t.is(count, 2);
        done();
      });
    t.is(pool._queue.length, 1);
  });
});
// test('listeners are removed from a worker after a task executes', async (t) => {
//   const events = [];

//   const pool = createPool(workerPath, { capacity: 1 });
//   t.is(pool._pool.length, 1);

//   const p1 = await pool.exec('wait', []);
//   pool.on('message', (evt) => {
//     events.push(evt);
//   });

//   console.log(events);

//   t.true(events.length > 0);
// });

test('throw if task times out', async (t) => {
  const pool = createPool(workerPath);

  await t.throwsAsync(() => pool.exec('test', [], { timeout: 5 }), {
    name: 'TimeoutError',
    message: 'Workflow failed to return within 5ms',
  });
});

test('after timeout, destroy the worker and reset the pool', async (t) => {
  return new Promise((done) => {
    const pool = createPool(workerPath, { capacity: 2 });
    t.deepEqual(pool._pool, [false, false]);

    pool.exec('test', [], { timeout: 5 }).catch(() => {
      t.true(worker.killed);
      t.deepEqual(pool._pool, [false, false]);
      done();
    });

    t.not(pool._pool, [false, false]);
    let [worker] = Object.values(pool._allWorkers);
    t.false(worker.killed);
  });
});
