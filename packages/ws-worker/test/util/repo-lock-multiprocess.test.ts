/**
 * Cross-process integration tests for repo-lock.
 *
 * Each test forks real child processes pointing at the same tmpdir to exercise
 * the proper-lockfile filesystem lock path that in-process tests cannot reach.
 *
 * Worker behaviour is configured via env vars; orchestration uses IPC barriers
 * so test ordering is deterministic (no setTimeout for control flow).
 */

import test from 'ava';
import path from 'node:path';
import os from 'node:os';
import {
  mkdir,
  mkdtemp,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WORKER_SCRIPT = path.resolve(__dirname, 'repo-lock-worker.ts');

// Node args to enable TypeScript via swc — uses the same register hook as ava.config.js
// (root ava.config.js also passes --experimental-vm-modules but that flag is harmless to omit here).
const EXEC_ARGV = ['--import=@swc-node/register/esm-register', '--no-warnings'];

const SPECIFIER_A = '@openfn/language-http@6.5.0';
const SPECIFIER_B = '@openfn/language-common@2.0.0';
// Alias format produced by getAliasedName
const ALIAS_A = '@openfn/language-http_6.5.0';
const ALIAS_B = '@openfn/language-common_2.0.0';

const fileExists = async (p: string) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

// ---- IPC helpers ----

interface WorkerMessage {
  event: string;
  [key: string]: unknown;
}

/**
 * Fork a worker process and return a handle with helpers.
 */
function spawnWorker(
  env: Record<string, string>
): { child: ChildProcess; messages: WorkerMessage[] } {
  const messages: WorkerMessage[] = [];

  const child = fork(WORKER_SCRIPT, [], {
    execArgv: EXEC_ARGV,
    env: { ...process.env, ...env },
    // IPC channel is created automatically by fork
  });

  child.on('message', (msg: any) => {
    messages.push(msg as WorkerMessage);
  });

  return { child, messages };
}

/**
 * Wait for a specific event from a child process.
 * Checks the buffered messages array first so events that arrived before this
 * call is reached are not missed.
 */
function waitForEvent(
  worker: { child: ChildProcess; messages: WorkerMessage[] },
  eventName: string,
  timeoutMs = 8000
): Promise<WorkerMessage> {
  // Check already-buffered messages first to avoid a hang if the event arrived
  // before the listener was attached.
  const buffered = worker.messages.find((m) => m.event === eventName);
  if (buffered) return Promise.resolve(buffered);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for event '${eventName}'`)),
      timeoutMs
    );

    const handler = (msg: any) => {
      if (msg?.event === eventName) {
        clearTimeout(timer);
        worker.child.off('message', handler);
        resolve(msg as WorkerMessage);
      }
    };

    worker.child.on('message', handler);
  });
}

/**
 * Collect N 'done' messages from a set of children (order is irrelevant).
 */
function collectDone(
  children: ChildProcess[],
  count: number,
  timeoutMs = 8000
): Promise<WorkerMessage[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${count} done messages (got ${results.length})`)),
      timeoutMs
    );

    const results: WorkerMessage[] = [];

    const handler = (msg: any) => {
      if (msg?.event === 'done') {
        results.push(msg);
        if (results.length >= count) {
          clearTimeout(timer);
          for (const c of children) c.off('message', handler);
          resolve(results);
        }
      }
    };

    for (const c of children) c.on('message', handler);
  });
}

/**
 * Wait for all children to send the 'ready' event, then return.
 */
function waitAllReady(children: ChildProcess[], timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timed out waiting for all workers to be ready')),
      timeoutMs
    );

    let remaining = children.length;

    for (const c of children) {
      const handler = (msg: any) => {
        if (msg?.event === 'ready') {
          c.off('message', handler);
          remaining--;
          if (remaining === 0) {
            clearTimeout(timer);
            resolve();
          }
        }
      };
      c.on('message', handler);
    }
  });
}

/** Wait for a child to exit. */
function waitExit(child: ChildProcess, timeoutMs = 8000): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timed out waiting for child to exit')),
      timeoutMs
    );
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

// ---- test lifecycle ----

test.beforeEach(async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ws-worker-mp-lock-'));
  t.context = { dir, children: [] as ChildProcess[] };
});

test.afterEach.always(async (t) => {
  const { dir, children } = t.context as { dir: string; children: ChildProcess[] };

  // Await child exits before removing tmpdir to avoid a race between SIGTERM
  // delivery and the rm -rf that follows.
  await Promise.all(
    children.map((c) => {
      // Already gone (naturally exited or previously killed).
      if (c.exitCode !== null || c.killed) return Promise.resolve();
      return new Promise<void>((r) => {
        c.once('exit', () => r());
        c.kill();
      });
    })
  );

  await rm(dir, { recursive: true, force: true });
});

function track(t: any, ...workers: ReturnType<typeof spawnWorker>[]) {
  const ctx = t.context as { children: ChildProcess[] };
  for (const w of workers) ctx.children.push(w.child);
  return workers;
}

// ---- Scenario 1: Race — exactly one install runs ----

test.serial('scenario 1: race — exactly one of N concurrent workers runs installFn', async (t) => {
  const { dir } = t.context as { dir: string };

  const env = {
    REPO_DIR: dir,
    SPECIFIER: SPECIFIER_A,
    WORKER_MODE: 'race',
    // 500ms: the window must outlast the slowest fork's swc-transpile startup time on CI
    INSTALL_DELAY: '500',
  };

  const workers = [
    spawnWorker(env),
    spawnWorker(env),
    spawnWorker(env),
  ];
  track(t, ...workers);

  // Wait until all three have imported the module and are ready.
  await waitAllReady(workers.map((w) => w.child));

  // Broadcast 'go' to all three simultaneously.
  for (const { child } of workers) child.send({ event: 'go' });

  // Collect all 'done' messages.
  const dones = await collectDone(workers.map((w) => w.child), 3);

  const totalInstalls = dones.reduce((s, m) => s + ((m.installCount as number) ?? 0), 0);
  const installStartEvents = workers.flatMap((w) =>
    w.messages.filter((m) => m.event === 'install-start')
  );

  t.is(totalInstalls, 1, 'exactly one worker should have run installFn');
  t.is(installStartEvents.length, 1, 'exactly one install-start event emitted');
  t.true(
    await fileExists(path.join(dir, '.sentinels', `${ALIAS_A}.done`)),
    'sentinel must exist'
  );
  t.true(
    await fileExists(path.join(dir, 'node_modules', ALIAS_A, 'package.json')),
    'node_modules pkg must exist'
  );
});

// ---- Scenario 2: Stale-lock recovery ----

test.serial('scenario 2: stale-lock recovery — new process steals a ghost lock', async (t) => {
  const { dir } = t.context as { dir: string };

  // Seed the ghost lock directory with an ancient mtime (simulates SIGKILL).
  const lockTarget = path.join(dir, '.locks', `${ALIAS_A}.lock`);
  await mkdir(path.dirname(lockTarget), { recursive: true });
  await writeFile(lockTarget, '');
  const ghostLockDir = `${lockTarget}.lock`;
  await mkdir(ghostLockDir, { recursive: true });
  const ancient = new Date(Date.now() - 5 * 60_000 - 1000);
  await utimes(ghostLockDir, ancient, ancient);

  const testStart = Date.now();

  const w = spawnWorker({
    REPO_DIR: dir,
    SPECIFIER: SPECIFIER_A,
    WORKER_MODE: 'default',
  });
  track(t, w);

  const done = await waitForEvent(w, 'done');

  t.falsy(done.error, `should complete without error, got: ${done.error}`);
  t.is(done.installCount, 1, 'installFn should have run once');
  t.true(
    await fileExists(path.join(dir, '.sentinels', `${ALIAS_A}.done`)),
    'sentinel must exist after stale recovery'
  );

  // The ghost lockdir should either be gone or have been replaced (newer mtime).
  const ghostStillExists = await fileExists(ghostLockDir);
  if (ghostStillExists) {
    const ghostStat = await stat(ghostLockDir);
    t.true(
      ghostStat.mtimeMs >= testStart,
      'lockdir mtime must be newer than test start, proving proper-lockfile took ownership'
    );
  }
  // If it doesn't exist, proper-lockfile cleaned it up — also fine.
});

// ---- Scenario 3: Per-alias concurrency ----

test.serial('scenario 3: different aliases do not serialise', async (t) => {
  const { dir } = t.context as { dir: string };

  const wA = spawnWorker({
    REPO_DIR: dir,
    SPECIFIER: SPECIFIER_A,
    WORKER_MODE: 'default',
    INSTALL_DELAY: '500',
  });
  const wB = spawnWorker({
    REPO_DIR: dir,
    SPECIFIER: SPECIFIER_B,
    WORKER_MODE: 'default',
    INSTALL_DELAY: '500',
  });
  track(t, wA, wB);

  const dones = await collectDone([wA.child, wB.child], 2);

  // Verify both succeeded.
  for (const done of dones) {
    t.falsy(done.error);
    t.is(done.installCount, 1);
  }

  t.true(await fileExists(path.join(dir, '.sentinels', `${ALIAS_A}.done`)));
  t.true(await fileExists(path.join(dir, '.sentinels', `${ALIAS_B}.done`)));

  // Confirm overlap: install-start events from A and B must be close in time.
  const startA = wA.messages.find((m) => m.event === 'install-start')?.t as number;
  const startB = wB.messages.find((m) => m.event === 'install-start')?.t as number;
  t.truthy(startA, 'worker A should emit install-start');
  t.truthy(startB, 'worker B should emit install-start');

  // Both should have started within half the install delay of each other.
  // If locks were global, one would wait ~500ms for the other to finish first.
  const timeDiff = Math.abs(startA - startB);
  t.true(
    timeDiff < 200,
    `install-start times should be close (${timeDiff}ms apart); if >200ms the installs were serialised`
  );
});

// ---- Scenario 4: Install failure — no sentinel written, next process retries ----

test.serial('scenario 4: install failure — no sentinel; next worker retries cleanly', async (t) => {
  const { dir } = t.context as { dir: string };

  const wA = spawnWorker({
    REPO_DIR: dir,
    SPECIFIER: SPECIFIER_A,
    WORKER_MODE: 'default',
    INSTALL_FAIL: '1',
  });
  track(t, wA);

  const doneA = await waitForEvent(wA, 'done');
  await waitExit(wA.child);

  t.truthy(doneA.error, 'child A should report an error');
  t.false(
    await fileExists(path.join(dir, '.sentinels', `${ALIAS_A}.done`)),
    'sentinel must not exist after failed install'
  );
  t.false(
    await fileExists(path.join(dir, '.locks', `${ALIAS_A}.lock.lock`)),
    'proper-lockfile lockdir must be released after install throws'
  );

  // Now fork a second worker that will succeed.
  const wB = spawnWorker({
    REPO_DIR: dir,
    SPECIFIER: SPECIFIER_A,
    WORKER_MODE: 'default',
  });
  track(t, wB);

  const doneB = await waitForEvent(wB, 'done');

  t.falsy(doneB.error);
  t.is(doneB.installCount, 1, 'second worker should have run install');
  t.true(
    await fileExists(path.join(dir, '.sentinels', `${ALIAS_A}.done`)),
    'sentinel must exist after successful second install'
  );
});

// ---- Scenario 5: Post-lock double-check — waiting process skips redundant install ----

test.serial('scenario 5: post-lock double-check — waiting process skips install after winner finishes', async (t) => {
  const { dir } = t.context as { dir: string };

  // Child A: acquires lock, signals parent (lock-acquired), waits for 'proceed',
  // then seeds node_modules and releases.
  const wA = spawnWorker({
    REPO_DIR: dir,
    SPECIFIER: SPECIFIER_A,
    WORKER_MODE: 'double-check',
  });
  track(t, wA);

  // Wait until A has the lock (but hasn't done any work yet).
  await waitForEvent(wA, 'lock-acquired');

  // Now fork B — it will try to acquire the same lock and queue behind A.
  const wB = spawnWorker({
    REPO_DIR: dir,
    SPECIFIER: SPECIFIER_A,
    WORKER_MODE: 'default',
  });
  track(t, wB);

  // Wait until B has actually called handleInstall (entered the lock path).
  // This guarantees B is blocking on lockfile.lock before A releases, so we
  // are genuinely testing cross-process contention, not just the double-check
  // on an uncontested lock.
  await waitForEvent(wB, 'lock-attempting');

  // Tell A to complete: it will seed node_modules, write sentinel, release lock.
  wA.child.send({ event: 'proceed' });

  await collectDone([wA.child, wB.child], 2);

  // Find each worker's done message from their own IPC message arrays.
  const doneAMsg = wA.messages.find((m) => m.event === 'done')!;
  const doneBMsg = wB.messages.find((m) => m.event === 'done')!;

  t.is(doneAMsg.installCount, 1, 'worker A should have run installFn once');
  t.true(doneBMsg.skipped as boolean, 'worker B should have skipped (in-lock double-check)');
  t.is(doneBMsg.installCount, 0, 'worker B installCount should be 0');

  t.true(await fileExists(path.join(dir, '.sentinels', `${ALIAS_A}.done`)));
  t.true(await fileExists(path.join(dir, 'node_modules', ALIAS_A, 'package.json')));
});

// ---- Scenario 6: Partial state — pkg without sentinel triggers install ----

test.serial('scenario 6: partial state — pkg without sentinel triggers install', async (t) => {
  const { dir } = t.context as { dir: string };

  // Pre-seed node_modules but NOT the sentinel (simulates a crash after npm install
  // but before writeSentinelAtomic).
  const pkgDir = path.join(dir, 'node_modules', ALIAS_A);
  await mkdir(pkgDir, { recursive: true });
  await writeFile(path.join(pkgDir, 'package.json'), '{}');
  // Also create the dirs that createLockedHandlers would normally create.
  await mkdir(path.join(dir, '.sentinels'), { recursive: true });
  await mkdir(path.join(dir, '.locks'), { recursive: true });

  const w = spawnWorker({
    REPO_DIR: dir,
    SPECIFIER: SPECIFIER_A,
    WORKER_MODE: 'partial',
    // installFn is a no-op; node_modules already exists, just needs sentinel.
    INSTALL_NOOP: '1',
  });
  track(t, w);

  const done = await waitForEvent(w, 'done');

  t.false(done.wasInstalled as boolean, 'handleIsInstalled should return false without sentinel');
  t.is(done.installCount, 1, 'install should have run once');
  t.true(done.installedAfter as boolean, 'handleIsInstalled should return true after install');
  t.true(
    await fileExists(path.join(dir, '.sentinels', `${ALIAS_A}.done`)),
    'sentinel must exist'
  );
});
