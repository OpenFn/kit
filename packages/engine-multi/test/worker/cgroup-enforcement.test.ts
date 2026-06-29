import test from 'ava';
import os from 'node:os';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';

import createPool from '../../src/worker/pool';

// These tests prove the kernel actually OOM-kills a runaway run via the
// cgroup's memory.max ceiling. That only works on Linux with a writable
// cgroup v2 hierarchy (e.g. a privileged container), so they are skipped
// everywhere else — including CI on macOS.
//
//   docker run --rm -it --privileged -v "$PWD":/kit -w /kit node:24 bash
//   corepack enable && pnpm install && pnpm --filter @openfn/engine-multi build
//   cd packages/engine-multi && pnpm ava test/worker/cgroup-enforcement.test.ts
const linuxOnly = os.platform() === 'linux' ? test.serial : test.serial.skip;

const workerPath = path.resolve('dist/test/worker-functions.js');
const logger = createMockLogger();

// Ceiling above Node's baseline RSS but low enough that blowNativeMemory
// crosses it almost immediately. memoryLimitMb is deliberately left unset so
// the V8 heap limit can't be what kills the run — only the cgroup can.
const cgroupMemoryLimitMb = 200;

linuxOnly(
  'cgroup OOM-kills a run that exceeds memory.max and surfaces OOMError',
  async (t) => {
    const pool = createPool(workerPath, { cgroupMemoryLimitMb }, logger);

    await t.throwsAsync(() => pool.exec('blowNativeMemory', []), {
      name: 'OOMError',
    });

    await pool.destroy();
  }
);

linuxOnly('pool recovers after a cgroup OOM kill', async (t) => {
  const pool = createPool(workerPath, { cgroupMemoryLimitMb }, logger);

  await t.throwsAsync(() => pool.exec('blowNativeMemory', []), {
    name: 'OOMError',
  });

  // The pool should restore the dead worker's slot and keep working.
  const result = await pool.exec('test', []);
  t.is(result, 42);

  await pool.destroy();
});
