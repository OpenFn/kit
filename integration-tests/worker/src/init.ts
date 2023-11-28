import path from 'node:path';
import crypto from 'node:crypto';

import createLightningServer from '@openfn/lightning-mock';
import createEngine from '@openfn/engine-multi';
import createWorkerServer from '@openfn/ws-worker';
import createLogger, { createMockLogger } from '@openfn/logger';

export const randomPort = () => parseInt(2000 + Math.random() * 1000);

export const initLightning = (port = 4000) => {
  // TODO the lightning mock right now doesn't use the secret
  // but we may want to add tests against this
  return createLightningServer({ port });
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
    ...workerArgs,
  });

  return { engine, engineLogger, worker };
};
