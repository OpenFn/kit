import test from 'ava';
import path from 'node:path';
import os from 'node:os';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
  stat,
  utimes,
} from 'node:fs/promises';
import { createMockLogger } from '@openfn/logger';
import { getAliasedName } from '@openfn/runtime';

import { createLockedHandlers } from '../../src/util/repo-lock';

const logger = createMockLogger();

const SPECIFIER = '@openfn/language-http@6.5.0';
const ALIAS = getAliasedName(SPECIFIER);

const fileExists = async (p: string) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

const seedModule = async (repoDir: string, alias = ALIAS) => {
  const dir = path.join(repoDir, 'node_modules', alias);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'package.json'), '{}');
};

const seedSentinel = async (repoDir: string, alias = ALIAS) => {
  const sentinel = path.join(repoDir, '.sentinels', `${alias}.done`);
  await mkdir(path.dirname(sentinel), { recursive: true });
  await writeFile(sentinel, '');
};

test.beforeEach(async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ws-worker-repo-lock-'));
  t.context = { dir };
});

test.afterEach.always(async (t) => {
  const { dir } = t.context as { dir: string };
  await rm(dir, { recursive: true, force: true });
});

test('handleIsInstalled returns false when sentinel and node_modules are missing', async (t) => {
  const { dir } = t.context as { dir: string };
  const { handleIsInstalled } = createLockedHandlers(dir);
  t.false(await handleIsInstalled(SPECIFIER, dir, logger));
});

test('handleIsInstalled returns true when both sentinel and node_modules exist', async (t) => {
  const { dir } = t.context as { dir: string };
  await seedSentinel(dir);
  await seedModule(dir);
  const { handleIsInstalled } = createLockedHandlers(dir);
  t.true(await handleIsInstalled(SPECIFIER, dir, logger));
});

test('handleIsInstalled returns false when sentinel exists but node_modules was deleted', async (t) => {
  const { dir } = t.context as { dir: string };
  await seedSentinel(dir);
  const { handleIsInstalled } = createLockedHandlers(dir);
  t.false(await handleIsInstalled(SPECIFIER, dir, logger));
});

test('handleIsInstalled returns false when node_modules exists but sentinel is missing', async (t) => {
  const { dir } = t.context as { dir: string };
  await seedModule(dir);
  const { handleIsInstalled } = createLockedHandlers(dir);
  t.false(await handleIsInstalled(SPECIFIER, dir, logger));
});

test('handleInstall runs install and writes sentinel on success', async (t) => {
  const { dir } = t.context as { dir: string };
  let installs = 0;
  const installFn = async () => {
    installs++;
    await seedModule(dir);
  };
  const { handleInstall, handleIsInstalled } = createLockedHandlers(
    dir,
    installFn
  );
  await handleInstall(SPECIFIER, dir, logger);

  t.is(installs, 1);
  t.true(
    await fileExists(path.join(dir, '.sentinels', `${ALIAS}.done`)),
    'sentinel file should be written'
  );
  t.true(await handleIsInstalled(SPECIFIER, dir, logger));
});

test('concurrent handleInstall calls only invoke install once', async (t) => {
  const { dir } = t.context as { dir: string };
  let installs = 0;
  const installFn = async () => {
    installs++;
    // Simulate work so the second call definitely contends on the lock
    await new Promise((r) => setTimeout(r, 100));
    await seedModule(dir);
  };

  const a = createLockedHandlers(dir, installFn);
  const b = createLockedHandlers(dir, installFn);

  await Promise.all([
    a.handleInstall(SPECIFIER, dir, logger),
    b.handleInstall(SPECIFIER, dir, logger),
  ]);

  t.is(installs, 1, 'only one of the two contending installs should run');
  t.true(await fileExists(path.join(dir, '.sentinels', `${ALIAS}.done`)));
});

test('handleInstall recovers a stale lock left by a dead worker', async (t) => {
  const { dir } = t.context as { dir: string };

  // Manually create the proper-lockfile lock directory with an old mtime,
  // simulating a worker that was SIGKILLed mid-install.
  const lockTarget = path.join(dir, '.locks', `${ALIAS}.lock`);
  await mkdir(path.dirname(lockTarget), { recursive: true });
  await writeFile(lockTarget, '');
  const ghostLockDir = `${lockTarget}.lock`;
  await mkdir(ghostLockDir, { recursive: true });
  const ancient = new Date(Date.now() - 5 * 60_000);
  await utimes(ghostLockDir, ancient, ancient);

  let installs = 0;
  const installFn = async () => {
    installs++;
    await seedModule(dir);
  };

  const { handleInstall } = createLockedHandlers(dir, installFn);
  await handleInstall(SPECIFIER, dir, logger);

  t.is(installs, 1);
  t.true(await fileExists(path.join(dir, '.sentinels', `${ALIAS}.done`)));
});

test('handleInstall does not re-run install when sentinel was written by another worker while waiting', async (t) => {
  const { dir } = t.context as { dir: string };

  let installs = 0;

  // First worker holds the lock and writes the sentinel; second worker queues
  // up behind it and should observe the sentinel inside the lock and skip.
  const installFn = async () => {
    installs++;
    await new Promise((r) => setTimeout(r, 50));
    await seedModule(dir);
  };

  const a = createLockedHandlers(dir, installFn);
  const b = createLockedHandlers(dir, async () => {
    // If b ever calls install, count it — but it shouldn't.
    installs++;
    await seedModule(dir);
  });

  const aPromise = a.handleInstall(SPECIFIER, dir, logger);
  // Give a a moment to grab the lock and start work.
  await new Promise((r) => setTimeout(r, 10));
  const bPromise = b.handleInstall(SPECIFIER, dir, logger);

  await Promise.all([aPromise, bPromise]);

  t.is(installs, 1);
});
