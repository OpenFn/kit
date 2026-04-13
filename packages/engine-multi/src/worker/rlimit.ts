import { execFileSync } from 'node:child_process';
import type { Logger } from '@openfn/logger';

let prlimitAvailable: boolean | null = null;

/**
 * Check if the prlimit command is available (Linux with util-linux).
 * Result is cached for the process lifetime.
 */
export function detectPrlimitSupport(logger: Logger): boolean {
  if (prlimitAvailable !== null) return prlimitAvailable;

  try {
    execFileSync('prlimit', ['--version'], { stdio: 'ignore' });
    prlimitAvailable = true;
    logger.info('prlimit: memory enforcement available');
  } catch {
    prlimitAvailable = false;
    logger.debug('prlimit: not available (util-linux not installed)');
  }

  return prlimitAvailable;
}

/**
 * Apply RLIMIT_AS (virtual address space limit) to a child process.
 * When exceeded, mmap/brk fails with ENOMEM, causing the process to crash.
 */
export function applyMemoryLimit(
  pid: number,
  limitBytes: number,
  logger: Logger
): boolean {
  try {
    execFileSync('prlimit', [
      '--pid',
      String(pid),
      `--as=${limitBytes}:${limitBytes}`,
    ]);
    logger.debug(
      `prlimit: worker ${pid} RLIMIT_AS set to ${Math.round(
        limitBytes / 1024 / 1024
      )}MB`
    );
    return true;
  } catch (e: any) {
    logger.warn(`prlimit: failed to set limit for worker ${pid}:`, e.message);
    return false;
  }
}

// Exported for testing only
export function _resetCache(): void {
  prlimitAvailable = null;
}
