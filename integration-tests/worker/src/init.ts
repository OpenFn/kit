import path from 'node:path';
import crypto from 'node:crypto';

import createLightningServer, { toBase64 } from '@openfn/lightning-mock';
import createEngine from '@openfn/engine-multi';
import createWorkerServer from '@openfn/ws-worker';
import { createMockLogger } from '@openfn/logger';
import createLogger from '@openfn/logger';

const debugWorker = process.env.OPENFN_DEBUG_WORKER;
const debugLightning = process.env.OPENFN_DEBUG_LIGHTNING;

// Hand out a fresh port for every server we start. This used to pick a random
// number in a 1000 wide range without checking it was free, which collided
// often enough to fail the integration job every few runs: the second server
// couldn't bind, its setup hook never finished, and the file timed out.
//
// ava runs these files one at a time and each one is its own process, so a
// counter is enough - ports are released when the previous file exits. The base
// sits clear of the 3000s that the server tests walk through.
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

  return { engine, engineLogger, worker };
};
