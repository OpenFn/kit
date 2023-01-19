import path from 'node:path';
import test from 'ava';
import mock from 'mock-fs';
import { createMockLogger } from '@openfn/logger';

import { validateMonoRepo, updatePath } from '../../src/util/use-adaptors-repo';

const REPO_PATH = 'a/b/c';
const ABS_REPO_PATH = path.resolve(REPO_PATH);

const logger = createMockLogger();

test.afterEach(() => {
  logger._reset();
});

test('updatePath: common', (t) => {
  const result = updatePath('common', REPO_PATH, logger);

  t.is(result, `common=${ABS_REPO_PATH}/packages/common`);
});

test('updatePath: @openfn/language-common', (t) => {
  const result = updatePath('@openfn/language-common', REPO_PATH, logger);

  t.is(result, `@openfn/language-common=${ABS_REPO_PATH}/packages/common`);
});

test('updatePath: common@1.2.3 (with warning)', (t) => {
  const result = updatePath('common@1.2.3', REPO_PATH, logger);

  t.is(result, `common=${ABS_REPO_PATH}/packages/common`);

  const { level, message } = logger._parse(logger._last);
  t.is(level, 'warn');
  t.regex(message as string, /ignoring version specifier/i);
});

test('updatePath: common=x/y/z', (t) => {
  const result = updatePath('common=x/y/z', REPO_PATH, logger);

  t.is(result, `common=x/y/z`);
});

// TODO can't test this in ava, have to use an integration test
test.skip('validate monorepo: log and exit early if repo not found', async (t) => {
  mock({
    a: {},
  });

  await t.throwsAsync(async () => validateMonoRepo(REPO_PATH, logger), {
    message: 'Monorepo not found',
  });
  const { level, message } = logger._parse(logger._last);
  t.is(level, 'error');
  t.is(message, `ERROR: Monorepo not found at ${REPO_PATH}`);
});

test('validate monorepo: all OK', async (t) => {
  mock({
    [`${REPO_PATH}/package.json`]: '{ "name": "adaptors" }',
  });

  await t.notThrowsAsync(async () => validateMonoRepo(REPO_PATH, logger));
});
