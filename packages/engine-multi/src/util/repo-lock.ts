import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import lockfile from 'proper-lockfile';
import type { Logger } from '@openfn/logger';

// k8s CPU throttling can delay the heartbeat setTimeout; 5 min avoids false-stale on tight clusters
const STALE_MS = 5 * 60_000;
// Retry ceiling exceeds STALE_MS so a dead lock-holder's stale window expires before we give up
const MAX_LOCK_WAIT_MS = STALE_MS + 60_000;
const LOCK_INTERVAL_MS = 2_000;
const UPDATE_MS = 5_000;

const LOCK_RETRY_OPTIONS = {
  retries: MAX_LOCK_WAIT_MS / LOCK_INTERVAL_MS,
  factor: 1,
  minTimeout: LOCK_INTERVAL_MS,
  maxTimeout: LOCK_INTERVAL_MS,
};

const ensureLockTarget = async (target: string) => {
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await writeFile(target, '', { flag: 'wx' });
  } catch (e: any) {
    if (e.code !== 'EEXIST') throw e;
  }
};

export const withInstallLock = async (
  repoDir: string,
  alias: string,
  logger: Logger,
  fn: () => Promise<void>
): Promise<void> => {
  // Defence-in-depth: refuse aliases that could escape the .locks directory.
  // Upstream whitelist filtering should make this unreachable.
  if (alias.split(/[/\\]/).includes('..') || path.isAbsolute(alias)) {
    throw new Error(`Invalid alias for install lock: ${alias}`);
  }

  const locksDir = path.join(repoDir, '.locks');
  const target = path.join(locksDir, `${alias}.lock`);

  await ensureLockTarget(target);

  logger.debug(`acquiring install lock for ${alias}`);
  let release: () => Promise<void>;

  const lockOpts = { stale: STALE_MS, update: UPDATE_MS, realpath: false };

  try {
    release = await lockfile.lock(target, { ...lockOpts, retries: 0 });
  } catch (e: any) {
    if (e.code !== 'ELOCKED') throw e;

    logger.info(
      `waiting for install lock on \`${alias}\` (another worker is installing)`
    );

    try {
      release = await lockfile.lock(target, {
        ...lockOpts,
        retries: LOCK_RETRY_OPTIONS,
      });
    } catch (e2: any) {
      if (e2.code === 'ELOCKED') {
        throw new Error(
          `Lock acquisition timed out after ${
            MAX_LOCK_WAIT_MS / 1000
          }s waiting for ${alias}; another worker likely still installing (lock: ${target})`
        );
      }
      throw e2;
    }
  }

  logger.debug(`acquired install lock for ${alias}`);

  try {
    await fn();
  } finally {
    try {
      await release();
    } catch (e) {
      logger.warn(`failed to release install lock for ${alias}:`, e);
    }
  }
};
