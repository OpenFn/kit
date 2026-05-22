/**
 * Cross-process integration tests for withInstallLock.
 *
 * Each test forks real child processes pointing at the same tmpdir to exercise
 * the proper-lockfile filesystem lock path that in-process tests cannot reach.
 * IPC barriers keep ordering deterministic.
 */

import test from 'ava';
import path from 'node:path';
import os from 'node:os';
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WORKER_SCRIPT = path.resolve(__dirname, 'repo-lock-worker.ts');

const EXEC_ARGV = ['--import=@swc-node/register/esm-register', '--no-warnings'];

const SPECIFIER_A = '@openfn/language-http@6.5.0';
const ALIAS_A = '@openfn/language-http_6.5.0';

const fileExists = async (p: string) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

interface WorkerMessage {
  event: string;
  [key: string]: unknown;
}

function spawnWorker(
  env: Record<string, string>
): { child: ChildProcess; messages: WorkerMessage[] } {
  const messages: WorkerMessage[] = [];

  const child = fork(WORKER_SCRIPT, [], {
    execArgv: EXEC_ARGV,
    env: { ...process.env, ...env },
  });

  child.on('message', (msg: any) => {
    messages.push(msg as WorkerMessage);
  });

  return { child, messages };
}

function waitForEvent(
  worker: { child: ChildProcess; messages: WorkerMessage[] },
  eventName: string,
  timeoutMs = 8000
): Promise<WorkerMessage> {
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

function collectDone(
  children: ChildProcess[],
  count: number,
  timeoutMs = 8000
): Promise<WorkerMessage[]> {
  return new Promise((resolve, reject) => {
    const results: WorkerMessage[] = [];
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `Timed out waiting for ${count} done messages (got ${results.length})`
          )
        ),
      timeoutMs
    );
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

test.beforeEach(async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'engine-multi-mp-lock-'));
  t.context = { dir, children: [] as ChildProcess[] };
});

test.afterEach.always(async (t) => {
  const { dir, children } = t.context as {
    dir: string;
    children: ChildProcess[];
  };
  await Promise.all(
    children.map((c) => {
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

// Scenario: race — multiple workers attempt the lock at the same time.
test.serial(
  'race: exactly one of N concurrent workers runs installFn',
  async (t) => {
    const { dir } = t.context as { dir: string };

    const env = {
      REPO_DIR: dir,
      SPECIFIER: SPECIFIER_A,
      WORKER_MODE: 'race',
      INSTALL_DELAY: '500',
    };

    const workers = [spawnWorker(env), spawnWorker(env), spawnWorker(env)];
    track(t, ...workers);

    await waitAllReady(workers.map((w) => w.child));
    for (const { child } of workers) child.send({ event: 'go' });

    const dones = await collectDone(workers.map((w) => w.child), 3);

    const totalInstalls = dones.reduce(
      (s, m) => s + ((m.installCount as number) ?? 0),
      0
    );
    const installStartEvents = workers.flatMap((w) =>
      w.messages.filter((m) => m.event === 'install-start')
    );

    t.is(totalInstalls, 1, 'exactly one worker should have run installFn');
    t.is(installStartEvents.length, 1, 'exactly one install-start emitted');
    t.true(
      await fileExists(path.join(dir, 'node_modules', ALIAS_A, 'package.json')),
      'node_modules pkg must exist'
    );
  }
);

// Scenario: double-check — A holds the lock, B waits, A finishes, B re-checks and skips.
test.serial(
  'double-check: waiting worker skips install after winner finishes',
  async (t) => {
    const { dir } = t.context as { dir: string };

    const wA = spawnWorker({
      REPO_DIR: dir,
      SPECIFIER: SPECIFIER_A,
      WORKER_MODE: 'double-check',
    });
    track(t, wA);

    await waitForEvent(wA, 'lock-acquired');

    const wB = spawnWorker({
      REPO_DIR: dir,
      SPECIFIER: SPECIFIER_A,
      WORKER_MODE: 'default',
    });
    track(t, wB);

    await waitForEvent(wB, 'lock-attempting');

    wA.child.send({ event: 'proceed' });

    await collectDone([wA.child, wB.child], 2);

    const doneA = wA.messages.find((m) => m.event === 'done')!;
    const doneB = wB.messages.find((m) => m.event === 'done')!;

    t.is(doneA.installCount, 1, 'worker A should have run installFn once');
    t.true(doneB.skipped as boolean, 'worker B should have skipped (re-check)');
    t.is(doneB.installCount, 0, 'worker B installCount should be 0');

    t.true(
      await fileExists(path.join(dir, 'node_modules', ALIAS_A, 'package.json'))
    );
  }
);

// Scenario: partial — node_modules pkg absent triggers install; present afterwards.
test.serial(
  'partial: missing node_modules pkg triggers install; present afterwards',
  async (t) => {
    const { dir } = t.context as { dir: string };

    await mkdir(path.join(dir, '.locks'), { recursive: true });

    const w = spawnWorker({
      REPO_DIR: dir,
      SPECIFIER: SPECIFIER_A,
      WORKER_MODE: 'partial',
    });
    track(t, w);

    const done = await waitForEvent(w, 'done');

    t.false(
      done.wasInstalled as boolean,
      'should not be installed before the lock runs'
    );
    t.is(done.installCount, 1, 'install should have run once');
    t.true(
      done.installedAfter as boolean,
      'should be installed once install fn has seeded node_modules'
    );
    t.true(
      await fileExists(path.join(dir, 'node_modules', ALIAS_A, 'package.json'))
    );
  }
);

// Scenario: default — single worker, no contention, just works.
test.serial('default: single worker installs cleanly', async (t) => {
  const { dir } = t.context as { dir: string };

  const w = spawnWorker({
    REPO_DIR: dir,
    SPECIFIER: SPECIFIER_A,
    WORKER_MODE: 'default',
  });
  track(t, w);

  const done = await waitForEvent(w, 'done');

  t.falsy(done.error, `should complete without error, got: ${done.error}`);
  t.is(done.installCount, 1, 'install should have run once');
  t.true(
    await fileExists(path.join(dir, 'node_modules', ALIAS_A, 'package.json'))
  );
});

// Sanity check: install failure releases the lockdir so retries are possible.
test.serial(
  'failure: install error releases the lock for a retry',
  async (t) => {
    const { dir } = t.context as { dir: string };

    const wA = spawnWorker({
      REPO_DIR: dir,
      SPECIFIER: SPECIFIER_A,
      WORKER_MODE: 'default',
      INSTALL_FAIL: '1',
    });
    track(t, wA);

    const doneA = await waitForEvent(wA, 'done');
    t.truthy(doneA.error, 'child A should report an error');
    t.false(
      await fileExists(path.join(dir, '.locks', `${ALIAS_A}.lock.lock`)),
      'proper-lockfile lockdir must be released after install throws'
    );

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
      await fileExists(path.join(dir, 'node_modules', ALIAS_A, 'package.json'))
    );
  }
);
