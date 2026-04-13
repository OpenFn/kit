import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import {
  detectPrlimitSupport,
  applyMemoryLimit,
  _resetCache,
} from '../../src/worker/rlimit';

const logger = createMockLogger();

test.beforeEach(() => {
  _resetCache();
});

test('detectPrlimitSupport caches the result across calls', (t) => {
  const result1 = detectPrlimitSupport(logger);
  const result2 = detectPrlimitSupport(logger);
  t.is(result1, result2);
});

// On macOS, prlimit is not available
const isLinux = process.platform === 'linux';

if (!isLinux) {
  test('detectPrlimitSupport returns false on non-Linux', (t) => {
    const result = detectPrlimitSupport(logger);
    t.false(result);
  });
}

test('applyMemoryLimit returns false when prlimit is not available', (t) => {
  if (detectPrlimitSupport(logger)) {
    t.pass('prlimit is available — skipping negative test');
    return;
  }
  const result = applyMemoryLimit(99999, 500 * 1024 * 1024, logger);
  t.false(result);
});

// Integration tests — only run on Linux with prlimit available
const hasPrlimit = isLinux && detectPrlimitSupport(createMockLogger());
_resetCache(); // reset after the check so tests start clean

const prlimitTest = hasPrlimit ? test : test.skip;

prlimitTest('applyMemoryLimit succeeds on own process', (t) => {
  // Apply a very generous limit to our own process (won't interfere with test)
  const result = applyMemoryLimit(process.pid, 8 * 1024 * 1024 * 1024, logger);
  t.true(result);
});
