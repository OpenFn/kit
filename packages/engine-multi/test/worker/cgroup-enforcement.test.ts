import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';

import createPool from '../../src/worker/pool';
import {
  isCgroupV2Available,
  resolveSelfCgroup,
  _resetAvailabilityCache,
} from '../../src/worker/cgroup';

// These tests prove the kernel actually OOM-kills a runaway run via the
// cgroup's memory.max ceiling. That needs a writable, delegated cgroup v2
// subtree (e.g. a privileged container), so they are skipped everywhere else.
// The gate must be real availability, not just the platform: without a
// working cgroup there is no limit of any kind on blowNativeMemory, and it
// would happily eat the whole host.
//
//   docker run --rm -it --privileged -v "$PWD":/kit -w /kit node:24 bash
//   corepack enable && pnpm install && pnpm --filter @openfn/engine-multi build
//   cd packages/engine-multi && pnpm ava test/worker/cgroup-enforcement.test.ts
const logger = createMockLogger();
const available = isCgroupV2Available(resolveSelfCgroup(), logger);
_resetAvailabilityCache();

const cgroupTest = available ? test.serial : test.serial.skip;

const workerPath = path.resolve('dist/test/worker-functions.js');

// Ceiling above Node's baseline RSS but low enough that blowNativeMemory
// crosses it almost immediately. memoryLimitMb is deliberately left unset so
// the V8 heap limit can't be what kills the run — only the cgroup can.
const cgroupMemoryLimitMb = 200;

cgroupTest(
  'cgroup OOM-kills a run that exceeds memory.max and surfaces OOMError',
  async (t) => {
    const pool = createPool(workerPath, { cgroupMemoryLimitMb }, logger);

    const err = await t.throwsAsync(() => pool.exec('blowNativeMemory', []), {
      name: 'OOMError',
    });
    t.is((err as any).source, 'cgroup');

    await pool.destroy();
  }
);

cgroupTest('pool recovers after a cgroup OOM kill', async (t) => {
  const pool = createPool(workerPath, { cgroupMemoryLimitMb }, logger);

  await t.throwsAsync(() => pool.exec('blowNativeMemory', []), {
    name: 'OOMError',
  });

  // The pool should restore the dead worker's slot and keep working.
  const result = await pool.exec('test', []);
  t.is(result, 42);

  await pool.destroy();
});
