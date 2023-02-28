import { createMockLogger } from '@openfn/logger';
import test from 'ava';
import { getAdaptorPath } from '../../src/metadata/handler';
import path from 'node:path';

const logger = createMockLogger(undefined, { level: 'debug' });

test.afterEach(() => {
  logger._reset();
});
test('should resolve a full file path with adaptor name', async (t) => {
  const p = '/repo/my-adaptor.js';
  const result = await getAdaptorPath(`adaptor=${p}`, logger, undefined);
  t.is(result, p);
});

test('should resolve a full file path only', async (t) => {
  const p = '/repo/my-adaptor.js';
  const result = await getAdaptorPath(p, logger, undefined);
  t.is(result, p);
});

test('should resolve a module path', async (t) => {
  const p = path.resolve('test/__modules__/@openfn/language-common');
  const result = await getAdaptorPath(`common=${p}`, logger, undefined);
  t.is(result, `${p}/index.js`);
});

// This needs to pass a version explicitly for now to pass the test
test('should resolve within the repo', async (t) => {
  const repoDir = path.resolve('test/__repo__');
  const result = await getAdaptorPath(
    '@openfn/language-common@0.0.1',
    logger,
    repoDir
  );
  t.is(
    result,
    `${repoDir}/node_modules/@openfn/language-common_0.0.1/index.js`
  );
});
