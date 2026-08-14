import path from 'node:path';
import crypto from 'node:crypto';

import createLightningServer, { toBase64 } from '@openfn/lightning-mock';
import createEngine from '@openfn/engine-multi';
import createWorkerServer, { INTERNAL_SOCKET_READY } from '@openfn/ws-worker';
import { createMockLogger } from '@openfn/logger';
import createLogger from '@openfn/logger';

const debugWorker = process.env.OPENFN_DEBUG_WORKER;
const debugLightning = process.env.OPENFN_DEBUG_LIGHTNING;

let nextPortNumber = 4400;

export const nextPort = () => nextPortNumber++;

export const initLightning = (port = 4000, privateKey?: string) => {
  // TODO the lightning mock right now doesn't use the secret
  // but we may want to add tests against this
  const opts: any = { port };
  if (privateKey) {
    opts.runPrivateKey = toBase64(privateKey);
  }
  if (debugLightning) {
    opts.logger = createLogger('LTG', { level: 'debug' });
  }
  return createLightningServer(opts);
};

export const initWorker = async (
  lightningPort,
  engineArgs = {},
  workerArgs = {}
) => {
  const workerPort = nextPort();

  const engineLogger = createMockLogger('engine', {
    level: 'debug',
    json: true,
  });

  const engine = await createEngine({
    logger: engineLogger,
    repoDir: path.resolve('./tmp/repo/default'),
    ...engineArgs,
  });

  const worker = createWorkerServer(engine, {
    logger: debugWorker
      ? createLogger('worker', { level: 'debug' })
      : createMockLogger(),
    port: workerPort,
    lightning: `ws://localhost:${lightningPort}/worker`,
    secret: crypto.randomUUID(),
    collectionsVersion: '1.0.0',
    messageTimeoutSeconds: 0.01,
    batchLogs: true,
    ...workerArgs,
  });

  if (!worker.socket) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('worker did not connect to lightning within 10s'));
      }, 10_000);

      worker.events.once(INTERNAL_SOCKET_READY, () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  return { engine, engineLogger, worker };
};
