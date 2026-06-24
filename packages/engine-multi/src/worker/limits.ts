import process from 'node:process';
import os from 'node:os';
import { execSync } from 'node:child_process';
import type { Logger } from '@openfn/logger';
import { ChildProcess } from 'node:child_process';
import { b, mb } from '../util/memory';
import type { PoolOptions } from './pool';

let prlimitAvailable: boolean | null = null;

/**
 * Check if the prlimit command is available (Linux with util-linux).
 * Result is cached for the process lifetime.
 */
export function detectPrlimitSupport(): boolean {
  if (prlimitAvailable === null) {
    try {
      execSync('prlimit', ['--version'], { stdio: 'ignore' });
      prlimitAvailable = true;
    } catch {
      prlimitAvailable = false;
    }
  }

  return prlimitAvailable;
}

export const getAvailableMemory = (options: PoolOptions): number => {
  if (options.totalMemoryMb) {
    return b(options.totalMemoryMb);
  }
  const total = os.totalmem();
  const constrained = process.constrainedMemory?.() ?? total;
  return Math.floor(Math.min(total, constrained));
};

export const calculateLimits = (
  totalMemory_bytes: number,
  mainProcessOverhead_bytes: number,
  capacity: number
): number => {
  return Math.floor((totalMemory_bytes - mainProcessOverhead_bytes) / capacity);
};

export function setHardMemoryLimit(
  child: ChildProcess,
  limit_bytes: number,
  logger: Logger
) {
  if (prlimitAvailable) {
    logger.debug(
      `pool: setting hard limit on pid ${child.pid} to ${Math.floor(
        mb(limit_bytes)
      )}mb`
    );
    const roundLimit = Math.round(limit_bytes);

    // this will set the hard and soft limits at once
    // The hard limit is the absolute maximum we can possibly set
    // (but doesn't actually allocate memory, just sets a ceiling)
    // The soft limit can be changed per run
    execSync(`prlimit --pid=${child.pid} --as=${roundLimit}`);

    // Pretty print the result
    const out = execSync(
      `prlimit --pid=${child.pid} --as --noheadings -o "SOFT,HARD,UNITS"`
    );
    logger.debug(' > ', out.toString());
  }
}

// TODO before each run starst, we should set the soft limit
// to that run's limit
/**
 * Set a memory limit on a child process
 * If prlmit is available, this will set the soft limit
 *
 * Apply RLIMIT_AS (virtual address space limit) to a child process.
 * When exceeded, mmap/brk fails with ENOMEM, causing the process to crash.
 */

// TODO: it's plausible that du to bad config the hard limit
// is lower than the actual run memory limit
// if this true we'll get an error here
// we should probably od a check and raise a warning, then use the smallest of soft and hard limit
// most runs should be quite happy to run in this
export function applyMemoryLimit(
  child: ChildProcess,
  limitBytes: number,
  logger: Logger
): boolean {
  if (prlimitAvailable) {
    const pid = child.pid;
    try {
      console.log({ hardLimit });
      console.log(`prlimit --pid ${child.pid} --as=${limitBytes}:`);
      // note we still have to pass the hard limit here
      const out = execSync(`prlimit --pid ${child.pid} --as=${limitBytes}:`);
      console.log({ out: out.toString() });
      logger.debug(
        `Soft memory limit on worker ${pid} set to ${Math.round(
          mb(limitBytes)
        )}MB`
      );
      return true;
    } catch (e: any) {
      logger.warn(`Failed to set soft for worker ${pid}:`, e.message);
      return false;
    }
  }
  return false;
}

// TODO rename this. maybe make it setprlimit rather than a global reset
// Exported for testing only
export function _resetCache(): void {
  prlimitAvailable = null;
}
