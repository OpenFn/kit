// TODO what do I do with this? Some tests are useful
// some are security minded
import path from 'node:path';
import test from 'ava';
import v8 from 'v8';

// These tests should all pass against the new pool implementation
// But to simplify the tests we should merge them into one file, or generally reorganise
// import workerpool from 'workerpool';
import actualCreatePool from '../../src/worker/pool';
import { createMockLogger } from '@openfn/logger';

const workerPath = path.resolve('dist/test/worker-functions.js');
const logger = createMockLogger('', { level: 'debug' });

let pool;

// note that a dedicated pool does not allow arbitrary code execution
const createDedicatedPool = (opts = {}) =>
  actualCreatePool(workerPath, { maxWorkers: 1, ...opts }, logger);

// The dedicated thing doesn't matter anymore
// TODO simplify all this
const createPool = createDedicatedPool;

test.afterEach(() => pool.destroy(true));

test.serial('run an expression inside a worker', async (t) => {
  pool = createPool();

  const result = await pool.exec('test', []);

  t.is(result, 42);
});

test.serial('expressions should have the same processId', async (t) => {
  pool = createDedicatedPool();

  const ids = {};

  const saveProcessId = (id: string) => {
    if (!ids[id]) {
      ids[id] = 0;
    }
    ids[id]++;
  };

  // Run 4 jobs and return the processId for each
  // With only one worker thread they should all be the same
  await Promise.all([
    pool.exec('processId', []).then(saveProcessId),
    pool.exec('processId', []).then(saveProcessId),
    pool.exec('processId', []).then(saveProcessId),
    pool.exec('processId', []).then(saveProcessId),
  ]);

  const allUsedIds = Object.keys(ids);

  t.is(allUsedIds.length, 1);
  t.is(ids[allUsedIds[0]], 4);
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
