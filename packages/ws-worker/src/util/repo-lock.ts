import path from 'node:path';
import { mkdir, stat, writeFile, rename } from 'node:fs/promises';
import lockfile from 'proper-lockfile';
import {
  getAliasedName,
  install as runtimeInstall,
} from '@openfn/runtime';
import type { Logger } from '@openfn/logger';

// k8s CPU throttling can delay the heartbeat setTimeout; 5 min avoids false-stale on tight clusters
const STALE_MS = 5 * 60_000;
// Retry ceiling exceeds STALE_MS so a dead lock-holder's stale window expires before we give up
const MAX_LOCK_WAIT_MS = STALE_MS + 60_000; // 6 min
const LOCK_INTERVAL_MS = 2_000;
const LOCK_RETRY_OPTIONS = {
  retries: MAX_LOCK_WAIT_MS / LOCK_INTERVAL_MS,
  factor: 1,
  minTimeout: LOCK_INTERVAL_MS,
  maxTimeout: LOCK_INTERVAL_MS,
};
const UPDATE_MS = 5_000;

const sentinelPath = (repoDir: string, alias: string) =>
  path.join(repoDir, '.sentinels', `${alias}.done`);

const lockTargetPath = (repoDir: string, alias: string) =>
  path.join(repoDir, '.locks', `${alias}.lock`);

const nodeModulesPkgPath = (repoDir: string, alias: string) =>
  path.join(repoDir, 'node_modules', alias, 'package.json');

const fileExists = async (p: string) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

const ensureLockTarget = async (target: string) => {
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await writeFile(target, '', { flag: 'wx' });
  } catch (e: any) {
    if (e.code !== 'EEXIST') throw e;
  }
};

const writeSentinelAtomic = async (sentinel: string) => {
  await mkdir(path.dirname(sentinel), { recursive: true });
  const tmp = `${sentinel}.tmp`;
  await writeFile(tmp, '');
  await rename(tmp, sentinel);
};

export type InstallFn = (
  specifier: string,
  repoDir: string,
  logger: Logger
) => Promise<unknown>;

const defaultInstall: InstallFn = (specifier, repoDir, logger) =>
  runtimeInstall([specifier], repoDir, logger);

export const createLockedHandlers = (
  repoDir: string,
  installFn: InstallFn = defaultInstall
) => {
  const locksDir = path.join(repoDir, '.locks');
  const sentinelsDir = path.join(repoDir, '.sentinels');

  const ensureDirs = (async () => {
    await mkdir(repoDir, { recursive: true });
    await mkdir(locksDir, { recursive: true });
    await mkdir(sentinelsDir, { recursive: true });
  })();

  const handleIsInstalled = async (
    specifier: string,
    _repoDir: string,
    _logger: Logger
  ): Promise<boolean> => {
    await ensureDirs;
    const alias = getAliasedName(specifier);
    const [hasSentinel, hasPkg] = await Promise.all([
      fileExists(sentinelPath(repoDir, alias)),
      fileExists(nodeModulesPkgPath(repoDir, alias)),
    ]);
    return hasSentinel && hasPkg;
  };

  const handleInstall = async (
    specifier: string,
    _repoDir: string,
    logger: Logger
  ): Promise<void> => {
    await ensureDirs;
    const alias = getAliasedName(specifier);
    const sentinel = sentinelPath(repoDir, alias);
    const pkg = nodeModulesPkgPath(repoDir, alias);
    const target = lockTargetPath(repoDir, alias);

    await ensureLockTarget(target);

    logger.debug(`acquiring install lock for ${specifier}`);
    let release: () => Promise<void>;
    try {
      release = await lockfile.lock(target, {
        retries: LOCK_RETRY_OPTIONS,
        stale: STALE_MS,
        update: UPDATE_MS,
        realpath: false,
      });
    } catch (e: any) {
      if (e.code === 'ELOCKED') {
        const waitSecs = MAX_LOCK_WAIT_MS / 1000;
        throw new Error(
          `Lock acquisition timed out after ${waitSecs}s waiting for ${alias}; another worker likely still installing (lock: ${target})`
        );
      }
      throw e;
    }
    logger.debug(`acquired install lock for ${specifier}`);

    try {
      const [hasSentinel, hasPkg] = await Promise.all([
        fileExists(sentinel),
        fileExists(pkg),
      ]);
      if (hasSentinel && hasPkg) {
        logger.debug(
          `another worker installed ${specifier} while waiting for lock; skipping install`
        );
        return;
      }

      await installFn(specifier, repoDir, logger);
      await writeSentinelAtomic(sentinel);
    } finally {
      try {
        await release();
      } catch (e) {
        logger.warn(`failed to release install lock for ${specifier}:`, e);
      }
    }
  };

  return { handleInstall, handleIsInstalled };
};
