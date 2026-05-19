/**
 * Worker script for cross-process repo-lock tests.
 *
 * Config is supplied via environment variables:
 *   REPO_DIR        - path to the shared tmpdir
 *   SPECIFIER       - package specifier to install
 *   WORKER_MODE     - one of: race | double-check | partial | default
 *   INSTALL_DELAY   - ms to sleep inside installFn (default 0)
 *   INSTALL_FAIL    - if '1', installFn throws
 *   INSTALL_NOOP    - if '1', installFn resolves immediately without seeding pkg
 *
 * IPC messages the worker sends to parent:
 *   { event: 'ready' }                        - worker is alive and module loaded
 *   { event: 'install-start', t: Date.now() } - installFn just started
 *   { event: 'lock-acquired' }                - inside the lock, before calling installFn
 *   { event: 'lock-attempting', t: Date.now() } - about to call handleInstall (entering lock path)
 *   { event: 'done', installCount, skipped?, wasInstalled?, error? }
 *
 * IPC messages the worker expects from parent (for barriers):
 *   { event: 'go' }      - start the handleInstall call (race scenario)
 *   { event: 'proceed' } - complete the installFn (double-check scenario)
 */

import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { createMockLogger, Logger } from '@openfn/logger';
import { getAliasedName } from '@openfn/runtime';
import { createLockedHandlers } from '../../src/util/repo-lock.js';

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

// Wait for a specific IPC message from the parent.
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let installCount = 0;

  // In double-check mode the installFn waits for a 'proceed' message so the
  // parent can guarantee ordering: A holds lock -> B queues -> A finishes -> B skips.
  let installFn: (specifier: string, repoDir: string, logger: Logger) => Promise<void>;

  if (workerMode === 'double-check') {
    // Child A: acquire lock, signal parent, wait for 'proceed', then complete.
    installFn = async () => {
      installCount++;
      // Register the listener before signalling the parent so 'proceed' cannot
      // arrive before the handler is attached.
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

  const { handleInstall, handleIsInstalled } = createLockedHandlers(
    repoDir,
    installFn
  );

  // Build the barrier promise BEFORE sending 'ready' so that if the parent
  // replies instantly the message isn't missed before the listener is attached.
  const goPromise = workerMode === 'race' ? waitForMessage('go') : null;

  // Signal parent that the module is imported and we are ready.
  send({ event: 'ready' });

  // In race mode, wait for the parent's 'go' before calling handleInstall.
  // This ensures all workers start as close together as possible.
  if (goPromise) {
    await goPromise;
  }

  if (workerMode === 'partial') {
    // Scenario 6: check handleIsInstalled, then install, then check again.
    const wasInstalled = await handleIsInstalled(specifier, repoDir, logger);
    send({ event: 'lock-attempting', t: Date.now() });
    try {
      await handleInstall(specifier, repoDir, logger);
    } catch (e: any) {
      send({ event: 'done', wasInstalled, installCount, error: e.message });
      return;
    }
    const installedAfter = await handleIsInstalled(specifier, repoDir, logger);
    send({ event: 'done', wasInstalled, installCount, installedAfter });
    return;
  }

  // Signal parent that this worker is about to enter the lock path.
  send({ event: 'lock-attempting', t: Date.now() });

  try {
    await handleInstall(specifier, repoDir, logger);
    const skipped = installCount === 0;
    send({ event: 'done', installCount, skipped });
  } catch (e: any) {
    send({ event: 'done', installCount, error: e.message });
  }
}

main().catch((e) => {
  send({ event: 'done', installCount: 0, error: e.message });
});
