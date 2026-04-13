import fs from 'node:fs';
import path from 'node:path';
import type { Logger } from '@openfn/logger';

type CgroupSupport = {
  supported: boolean;
  cgroupRoot: string | null;
};

let cachedResult: CgroupSupport | null = null;

/**
 * Detect whether cgroup v2 memory enforcement is available.
 * Called once at pool creation; result is cached for the process lifetime.
 */
export function detectCgroupSupport(logger: Logger): CgroupSupport {
  if (cachedResult) return cachedResult;

  try {
    // Step 1: confirm cgroup v2
    if (!fs.existsSync('/sys/fs/cgroup/cgroup.controllers')) {
      logger.debug('cgroup: v2 not available');
      cachedResult = { supported: false, cgroupRoot: null };
      return cachedResult;
    }

    // Step 2: find our cgroup path
    const procCgroup = fs.readFileSync('/proc/self/cgroup', 'utf-8').trim();
    const match = procCgroup.match(/^0::(.+)$/m);
    if (!match) {
      logger.debug('cgroup: could not parse /proc/self/cgroup');
      cachedResult = { supported: false, cgroupRoot: null };
      return cachedResult;
    }

    const cgroupRoot = path.join('/sys/fs/cgroup', match[1]);

    // Step 3: ensure memory controller is delegated
    const subtreeControl = fs
      .readFileSync(path.join(cgroupRoot, 'cgroup.subtree_control'), 'utf-8')
      .trim();

    if (!subtreeControl.includes('memory')) {
      // Try to enable memory delegation
      try {
        fs.writeFileSync(
          path.join(cgroupRoot, 'cgroup.subtree_control'),
          '+memory'
        );
      } catch (e: any) {
        if (e.code === 'EBUSY') {
          // "no internal process" constraint — move ourselves to a child cgroup
          const initPath = path.join(cgroupRoot, 'openfn-init');
          try {
            fs.mkdirSync(initPath, { recursive: true });
            fs.writeFileSync(
              path.join(initPath, 'cgroup.procs'),
              String(process.pid)
            );
            fs.writeFileSync(
              path.join(cgroupRoot, 'cgroup.subtree_control'),
              '+memory'
            );
          } catch (inner: any) {
            logger.warn(
              'cgroup: failed to delegate memory controller:',
              inner.message
            );
            cachedResult = { supported: false, cgroupRoot: null };
            return cachedResult;
          }
        } else {
          logger.warn('cgroup: failed to enable memory controller:', e.message);
          cachedResult = { supported: false, cgroupRoot: null };
          return cachedResult;
        }
      }
    }

    // Step 4: smoke test — create and remove a probe cgroup
    const probePath = path.join(cgroupRoot, `openfn-probe-${process.pid}`);
    try {
      fs.mkdirSync(probePath);
      fs.writeFileSync(path.join(probePath, 'memory.max'), '1073741824'); // 1GB
      fs.rmdirSync(probePath);
    } catch (e: any) {
      logger.warn('cgroup: smoke test failed:', e.message);
      cachedResult = { supported: false, cgroupRoot: null };
      return cachedResult;
    }

    logger.info('cgroup: memory enforcement available at', cgroupRoot);
    cachedResult = { supported: true, cgroupRoot };
    return cachedResult;
  } catch (e: any) {
    logger.debug('cgroup: detection failed:', e.message);
    cachedResult = { supported: false, cgroupRoot: null };
    return cachedResult;
  }
}

/**
 * Create a cgroup for a child process and apply a memory limit.
 * Returns the cgroup directory path, or null on failure.
 */
export function setupCgroup(
  pid: number,
  memoryLimitBytes: number,
  cgroupRoot: string,
  logger: Logger
): string | null {
  const cgroupPath = path.join(cgroupRoot, `openfn-worker-${pid}`);

  try {
    fs.mkdirSync(cgroupPath);
    fs.writeFileSync(
      path.join(cgroupPath, 'memory.max'),
      String(memoryLimitBytes)
    );
    fs.writeFileSync(path.join(cgroupPath, 'memory.swap.max'), '0');
    fs.writeFileSync(path.join(cgroupPath, 'cgroup.procs'), String(pid));

    logger.debug(
      `cgroup: worker ${pid} limited to ${Math.round(
        memoryLimitBytes / 1024 / 1024
      )}MB`
    );
    return cgroupPath;
  } catch (e: any) {
    logger.warn(
      `cgroup: failed to set up cgroup for worker ${pid}:`,
      e.message
    );
    // Clean up partial state
    try {
      fs.rmdirSync(cgroupPath);
    } catch {
      // ignore cleanup failure
    }
    return null;
  }
}

/**
 * Remove a cgroup directory after the child process has exited.
 */
export function cleanupCgroup(cgroupPath: string, logger: Logger): void {
  try {
    fs.rmdirSync(cgroupPath);
  } catch (e: any) {
    if (e.code !== 'ENOENT') {
      logger.warn('cgroup: cleanup failed for', cgroupPath, e.message);
    }
  }
}

// Exported for testing only
export function _resetCache(): void {
  cachedResult = null;
}
