/**
 * Worker script for cross-process repo-lock tests in engine-multi.
 *
 * Drives `withInstallLock` directly (the new public lock surface) rather than
 * any wrapping handler. The install marker is `node_modules/<alias>/package.json`
 * — npm's per-package extraction is atomic so its presence is sufficient proof
 * of a successful install.
 *
 * Config (env vars):
 *   REPO_DIR        - path to the shared tmpdir
 *   SPECIFIER       - package specifier to install
 *   WORKER_MODE     - one of: race | double-check | partial | default
 *   INSTALL_DELAY   - ms to sleep inside the install fn (default 0)
 *   INSTALL_FAIL    - if '1', the install fn throws
 *   INSTALL_NOOP    - if '1', resolves without seeding node_modules
 *
 * IPC out -> parent:
 *   { event: 'ready' }                                  - module loaded
 *   { event: 'install-start', t }                       - inside install fn
 *   { event: 'lock-acquired' }                          - inside lock, before work (double-check)
 *   { event: 'lock-attempting', t }                     - about to acquire lock
 *   { event: 'done', installCount, skipped?, wasInstalled?, installedAfter?, error? }
 *
 * IPC in <- parent:
 *   { event: 'go' }      - start the lock attempt (race)
 *   { event: 'proceed' } - complete the install fn (double-check)
 */

import path from 'node:path';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { createMockLogger } from '@openfn/logger';
import { getAliasedName } from '@openfn/runtime';
import { withInstallLock } from '../../src/util/repo-lock.js';

const repoDir = process.env.REPO_DIR!;
const specifier = process.env.SPECIFIER!;
const installDelay = parseInt(process.env.INSTALL_DELAY ?? '0', 10);
const installFail = process.env.INSTALL_FAIL === '1';
const installNoop = process.env.INSTALL_NOOP === '1';
const workerMode = process.env.WORKER_MODE ?? 'default';

const logger = createMockLogger();
const alias = getAliasedName(specifier);

const send = (msg: Record<string, unknown>) => {
  if (process.send) process.send(msg);
};

const waitForMessage = (eventName: string): Promise<void> =>
  new Promise((resolve) => {
    const handler = (msg: any) => {
      if (msg?.event === eventName) {
        process.off('message', handler);
        resolve();
      }
    };
    process.on('message', handler);
  });

const seedModule = async () => {
  const dir = path.join(repoDir, 'node_modules', alias);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'package.json'), '{}');
};

const moduleInstalled = async () => {
  try {
    await stat(path.join(repoDir, 'node_modules', alias, 'package.json'));
    return true;
  } catch {
    return false;
  }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let installCount = 0;

  let installFn: () => Promise<void>;

  if (workerMode === 'double-check') {
    // Acquire lock, signal parent, wait for 'proceed', then complete.
    installFn = async () => {
      installCount++;
      const proceedPromise = waitForMessage('proceed');
      send({ event: 'lock-acquired' });
      await proceedPromise;
      await seedModule();
      if (installDelay > 0) await sleep(installDelay);
    };
  } else {
    installFn = async () => {
      send({ event: 'install-start', t: Date.now() });
      installCount++;
      if (installFail) {
        throw new Error('npm exploded');
      }
      if (installDelay > 0) await sleep(installDelay);
      if (!installNoop) {
        await seedModule();
      }
    };
  }

  // Wrap fn with the same double-check pattern autoinstall uses inside the lock:
  // re-check installed state before running the install fn.
  const lockedInstall = async () => {
    await withInstallLock(repoDir, alias, logger, async () => {
      if (await moduleInstalled()) {
        return;
      }
      await installFn();
    });
  };

  const goPromise = workerMode === 'race' ? waitForMessage('go') : null;

  send({ event: 'ready' });

  if (goPromise) {
    await goPromise;
  }

  if (workerMode === 'partial') {
    const wasInstalled = await moduleInstalled();
    send({ event: 'lock-attempting', t: Date.now() });
    try {
      await lockedInstall();
    } catch (e: any) {
      send({ event: 'done', wasInstalled, installCount, error: e.message });
      return;
    }
    const installedAfter = await moduleInstalled();
    send({ event: 'done', wasInstalled, installCount, installedAfter });
    return;
  }

  send({ event: 'lock-attempting', t: Date.now() });

  try {
    await lockedInstall();
    const skipped = installCount === 0;
    send({ event: 'done', installCount, skipped });
  } catch (e: any) {
    send({ event: 'done', installCount, error: e.message });
  }
}

main().catch((e) => {
  send({ event: 'done', installCount: 0, error: e.message });
});
