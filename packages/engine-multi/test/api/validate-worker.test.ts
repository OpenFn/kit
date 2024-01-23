import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';

import initWorkers from '../../src/api/call-worker';
import validateWorker from '../../src/api/validate-worker';

const logger = createMockLogger();

test('validate should not throw if the worker path is valid', async (t) => {
  const workerPath = path.resolve('dist/test/worker-functions.js');
  const api = initWorkers(workerPath, {}, logger);
  await t.notThrowsAsync(() => validateWorker(api as any));
});

test('validate should throw if the worker path is invalid', async (t) => {
  const workerPath = 'a/b/c.js';
  const api = initWorkers(workerPath, { silent: true }, logger);
  await t.throwsAsync(() => validateWorker(api as any), {
    message: 'Invalid worker path',
  });
});

test('validate should throw if the worker does not respond to a handshake', async (t) => {
  const workerPath = path.resolve('src/test/bad-worker.js');
  const api = initWorkers(workerPath, { silent: true }, logger);
  await t.throwsAsync(() => validateWorker(api as any), {
    message: 'Invalid worker path',
  });
});
