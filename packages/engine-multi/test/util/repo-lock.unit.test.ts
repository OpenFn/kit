/**
 * In-process unit tests for withInstallLock guards.
 *
 * The sibling `repo-lock.test.ts` exercises the real filesystem lock via
 * forked workers; these tests cover input validation that never reaches the
 * lock acquisition path.
 */

import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import { withInstallLock } from '../../src/util/repo-lock';

const logger = createMockLogger();

const shouldNotRun = async () => {
  throw new Error('install fn must not run when alias is rejected');
};

test('rejects alias containing ".."', async (t) => {
  await t.throwsAsync(
    () => withInstallLock('/tmp/repo', '../evil', logger, shouldNotRun),
    { message: /Invalid alias for install lock/ }
  );
});

test('rejects absolute-path alias', async (t) => {
  await t.throwsAsync(
    () => withInstallLock('/tmp/repo', '/etc/passwd', logger, shouldNotRun),
    { message: /Invalid alias for install lock/ }
  );
});
