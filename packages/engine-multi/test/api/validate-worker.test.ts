import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';

import initWorkers from '../../src/api/call-worker';
import validateWorker from '../../src/api/validate-worker';

const logger = createMockLogger();

test.afterEach(() => {
  logger._reset();
});

test('validate should not throw if the worker path is valid', async (t) => {
  const workerPath = path.resolve('dist/test/worker-functions.js');
  const api = initWorkers(workerPath, {}, logger);

  await t.notThrowsAsync(() => validateWorker(api as any, logger));
});

test('validate should throw if the worker path is invalid', async (t) => {
  const workerPath = 'a/b/c.js';
  const api = initWorkers(workerPath, {}, logger);

  await t.throwsAsync(() => validateWorker(api as any, logger), {
    name: 'WorkerValidationError',
  });
});

test('validate should throw if the worker does not respond to a handshake', async (t) => {
  const workerPath = path.resolve('src/test/bad-worker.js');
  const api = initWorkers(workerPath, {}, logger);
  const opts = { timeout: 100 };

  await t.throwsAsync(() => validateWorker(api as any, logger, opts), {
    name: 'WorkerValidationError',
  });
});

test('validate should retry with a backoff', async (t) => {
  const workerPath = path.resolve('src/test/bad-worker.js');
  const api = initWorkers(workerPath, {}, logger);
  const opts = { timeout: 10, retries: 3 };

  await t.throwsAsync(() => validateWorker(api as any, logger, opts), {
    name: 'WorkerValidationError',
  });

  const warnings = logger._history.filter(([level, _icon, message]) => {
    return level === 'warn' && message.match(/will retry/);
  });
  t.is(warnings.length, 2);
});
