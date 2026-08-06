/**
 * These tests prove the kernel actually OOM-kills a runaway run via the cgroup's memory.max ceiling.
 * Tests run with node's oldspace enforcement disabled: cgroups are the only lever we can use to trigger an OOM error.
 *
 * !!!IMPORTANT!!
 *
 * This is NOT safe to run directly from a terminal as the owning cgroup will be terminated
 * Use `pnpm test:cgroup` to run the test in a detatched process
 */
import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';

import createPool from '../../src/worker/pool';
import {
  isCgroupV2Available,
  resolveSelfCgroup,
  _resetAvailabilityCache,
} from '../../src/worker/cgroup';

const logger = createMockLogger();

const available = isCgroupV2Available(resolveSelfCgroup(), logger);
_resetAvailabilityCache();

const cgroupTest = available ? test.serial : test.serial.skip;

const workerPath = path.resolve('dist/test/worker-functions.js');

const memoryLimitMb = 72; // + 128mb headroom = 200mb effective cgroup ceiling

// Disable node's oldspace memory limit so that croup is the only variable in play
const memoryEnforcement = { cgroup: true, oldspace: false };

cgroupTest(
  'cgroup OOM-kills a run that exceeds memory.max and surfaces OOMError',
  async (t) => {
    const pool = createPool(
      workerPath,
      { memoryLimitMb, memoryEnforcement },
      logger
    );

    const err = await t.throwsAsync(() => pool.exec('blowNativeMemory', []), {
      name: 'OOMError',
    });
    t.is((err as any).source, 'cgroup');

    await pool.destroy();
  }
);

cgroupTest('pool recovers after a cgroup OOM kill', async (t) => {
  const pool = createPool(
    workerPath,
    { memoryLimitMb, memoryEnforcement },
    logger
  );

  await t.throwsAsync(() => pool.exec('blowNativeMemory', []), {
    name: 'OOMError',
  });

  // The pool should restore the dead worker's slot and keep working.
  const result = await pool.exec('test', []);
  t.is(result, 42);

  await pool.destroy();
});
