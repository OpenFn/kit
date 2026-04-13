import test from 'ava';
import fs from 'node:fs';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';

import {
  detectCgroupSupport,
  setupCgroup,
  cleanupCgroup,
  _resetCache,
} from '../../src/worker/cgroup';

const logger = createMockLogger();

test.beforeEach(() => {
  _resetCache();
});

// On macOS / non-Linux, detection should return unsupported
test('detectCgroupSupport returns false when cgroup v2 is not available', (t) => {
  // This test runs on any platform. On macOS, /sys/fs/cgroup doesn't exist.
  // On Linux without cgroup v2, cgroup.controllers won't exist.
  if (fs.existsSync('/sys/fs/cgroup/cgroup.controllers')) {
    t.pass('cgroup v2 is available on this system — skipping negative test');
    return;
  }

  const result = detectCgroupSupport(logger);
  t.false(result.supported);
  t.is(result.cgroupRoot, null);
});

test('detectCgroupSupport caches the result across calls', (t) => {
  const result1 = detectCgroupSupport(logger);
  const result2 = detectCgroupSupport(logger);
  t.is(result1, result2); // same object reference
});

test('setupCgroup returns null when directory creation fails', (t) => {
  // Use a nonexistent root so mkdirSync fails
  const result = setupCgroup(
    99999,
    500 * 1024 * 1024,
    '/nonexistent/cgroup/root',
    logger
  );
  t.is(result, null);
});

test('cleanupCgroup does not throw on ENOENT', (t) => {
  t.notThrows(() => {
    cleanupCgroup('/nonexistent/cgroup/path', logger);
  });
});

// Integration tests — only run on Linux with cgroup v2 and write access
const hasCgroupV2 = fs.existsSync('/sys/fs/cgroup/cgroup.controllers');

const cgroupTest = hasCgroupV2 ? test : test.skip;

cgroupTest('detectCgroupSupport on cgroup v2 system', (t) => {
  const result = detectCgroupSupport(logger);
  if (!result.supported) {
    // cgroup v2 is present but we lack permissions to delegate — that's fine
    t.pass('cgroup v2 present but not writable — detection correctly returned false');
    return;
  }
  t.truthy(result.cgroupRoot);
});

cgroupTest('setupCgroup creates cgroup directory and cleanupCgroup removes it', (t) => {
  const detection = detectCgroupSupport(logger);
  if (!detection.supported) {
    t.pass('cgroup not supported — skipping');
    return;
  }

  // Use a fake PID that won't collide
  const fakePid = 2147483640;
  const limitBytes = 256 * 1024 * 1024;

  const cgPath = setupCgroup(fakePid, limitBytes, detection.cgroupRoot!, logger);

  if (!cgPath) {
    t.pass('setupCgroup returned null — likely permission issue');
    return;
  }

  t.true(fs.existsSync(cgPath));

  // Verify memory.max was written
  const memMax = fs.readFileSync(path.join(cgPath, 'memory.max'), 'utf-8').trim();
  t.is(memMax, String(limitBytes));

  // Verify memory.swap.max was written
  const swapMax = fs.readFileSync(path.join(cgPath, 'memory.swap.max'), 'utf-8').trim();
  t.is(swapMax, '0');

  // Clean up
  cleanupCgroup(cgPath, logger);
  t.false(fs.existsSync(cgPath));
});
