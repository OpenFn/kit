/**
 * In-process unit tests for withInstallLock alias validation.
 *
 * The sibling `repo-lock.test.ts` exercises the real cross-process filesystem
 * lock via forked workers; these tests focus on the alias guard.
 */

import test from 'ava';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { createMockLogger } from '@openfn/logger';

import { withInstallLock } from '../../src/util/repo-lock';

const logger = createMockLogger();

const shouldNotRun = async () => {
  throw new Error('install fn must not run when alias is rejected');
};

test('rejects ".." as a path component but allows it as a substring', async (t) => {
  await t.throwsAsync(
    () => withInstallLock('/tmp/repo', '../evil', logger, shouldNotRun),
    { message: /Invalid alias for install lock/ }
  );

  const dir = await mkdtemp(path.join(os.tmpdir(), 'engine-multi-lock-unit-'));
  t.teardown(() => rm(dir, { recursive: true, force: true }));

  let ran = false;
  await withInstallLock(dir, 'foo..bar', logger, async () => {
    ran = true;
  });
  t.true(ran);
});

test('rejects absolute-path alias', async (t) => {
  await t.throwsAsync(
    () => withInstallLock('/tmp/repo', '/etc/passwd', logger, shouldNotRun),
    { message: /Invalid alias for install lock/ }
  );
});
