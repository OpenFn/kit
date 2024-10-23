import path from 'node:path';
import crypto from 'node:crypto';

import createLightningServer, { toBase64 } from '@openfn/lightning-mock';
import createEngine from '@openfn/engine-multi';
import createWorkerServer from '@openfn/ws-worker';
import { createMockLogger } from '@openfn/logger';

export const randomPort = () => Math.round(2000 + Math.random() * 1000);

export const initLightning = (port = 4000, privateKey?: string) => {
  // TODO the lightning mock right now doesn't use the secret
  // but we may want to add tests against this
  const opts = { port };
  if (privateKey) {
    // @ts-ignore
    opts.runPrivateKey = toBase64(privateKey);
  }
  return createLightningServer(opts);
};

export const initWorker = async (
  lightningPort,
  engineArgs = {},
  workerArgs = {}
) => {
  const workerPort = randomPort();

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
    logger: createMockLogger(),
    // logger: createLogger('worker', { level: 'debug' }),
    port: workerPort,
    lightning: `ws://localhost:${lightningPort}/worker`,
    secret: crypto.randomUUID(),
    collectionsVersion: '1.0.0',
    ...workerArgs,
  });

  return { engine, engineLogger, worker };
};
