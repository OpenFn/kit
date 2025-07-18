#!/usr/bin/env node
import createLogger from '@openfn/logger';
import createRTE from '@openfn/engine-multi';
import createMockRTE from './mock/runtime-engine';
import createWorker, { ServerOptions } from './server';
import cli from './util/cli';

const args = cli(process.argv);

const logger = createLogger('SRV', { level: args.log });

logger.info('Starting worker server...');

if (args.lightning === 'mock') {
  args.lightning = 'ws://localhost:8888/worker';
  if (!args.secret) {
    // Set a fake secret to stop the console warning
    args.secret = 'abdefg';
  }
} else if (!args.debug && !args.secret) {
  logger.error('WORKER_SECRET is not set');
  process.exit(1);
}

const [minBackoff, maxBackoff] = args.backoff
  .split('/')
  .map((n: string) => parseFloat(n) * 1000);

function engineReady(engine: any) {
  logger.debug('Creating worker instance');
  const workerOptions: ServerOptions = {
    port: args.port,
    lightning: args.lightning,
    logger,
    secret: args.secret,
    sentryDsn: args.sentryDsn,
    sentryEnv: args.sentryEnv,
    noLoop: !args.loop,
    backoff: {
      min: minBackoff,
      max: maxBackoff,
    },
    maxWorkflows: args.capacity,
    payloadLimitMb: args.payloadMemory,
    collectionsVersion: args.collectionsVersion,
    collectionsUrl: args.collectionsUrl,
    monorepoDir: args.monorepoDir,
    messageTimeoutSeconds: args.messageTimeoutSeconds,
    socketTimeoutSeconds: args.socketTimeoutSeconds,
  };

  if (args.lightningPublicKey) {
    logger.info(
      'Lightning public key found: run tokens from Lightning will be verified by this worker'
    );
    workerOptions.runPublicKey = Buffer.from(
      args.lightningPublicKey,
      'base64'
    ).toString();
  }

  const {
    logger: _l,
    secret: _s,
    runPublicKey,
    ...humanOptions
  } = workerOptions;
  logger.debug('Worker options:', humanOptions);

  createWorker(engine, workerOptions);
  logger.success('Worker started OK');
}

if (args.mock) {
  createMockRTE().then((engine) => {
    logger.debug('Mock engine created');
    engineReady(engine);
  });
} else {
  const engineOptions = {
    repoDir: args.repoDir,
    memoryLimitMb: args.runMemory,
    maxWorkers: args.capacity,
    statePropsToRemove: args.statePropsToRemove,
    runTimeoutMs: args.maxRunDurationSeconds * 1000,
  };
  logger.debug('Creating runtime engine...');
  logger.debug('Engine options:', engineOptions);

  createRTE(engineOptions).then((engine) => {
    logger.debug('Engine created!');
    engineReady(engine);
  });
}
