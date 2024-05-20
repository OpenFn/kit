#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import createLogger, { LogLevel } from '@openfn/logger';

import createRTE from '@openfn/engine-multi';
import createMockRTE from './mock/runtime-engine';
import createWorker, { ServerOptions } from './server';

type Args = {
  _: string[];
  port?: number;
  lightning?: string;
  repoDir?: string;
  secret?: string;
  loop?: boolean;
  log: LogLevel;
  lightningPublicKey?: string;
  mock: boolean;
  backoff: string;
  capacity?: number;
  runMemory?: number;
  statePropsToRemove?: string[];
  maxRunDurationSeconds: number;
};

const {
  WORKER_BACKOFF,
  WORKER_CAPACITY,
  WORKER_LIGHTNING_PUBLIC_KEY,
  WORKER_LIGHTNING_SERVICE_URL,
  WORKER_LOG_LEVEL,
  WORKER_MAX_RUN_DURATION_SECONDS,
  WORKER_MAX_RUN_MEMORY_MB,
  WORKER_PORT,
  WORKER_REPO_DIR,
  WORKER_SECRET,
  WORKER_STATE_PROPS_TO_REMOVE,
} = process.env;

const args = yargs(hideBin(process.argv))
  .command('server', 'Start a ws-worker server')
  .option('port', {
    alias: 'p',
    description: 'Port to run the server on. Env: WORKER_PORT',
    type: 'number',
    default: WORKER_PORT || 2222,
  })
  // TODO maybe this is positional and required?
  // frees up -l for the log
  .option('lightning', {
    alias: ['l', 'lightning-service-url'],
    description:
      'Base url to Lightning websocket endpoint, eg, ws://localhost:4000/worker. Set to "mock" to use the default mock server. Env: WORKER_LIGHTNING_SERVICE_URL',
    default: WORKER_LIGHTNING_SERVICE_URL || 'ws://localhost:4000/worker',
  })
  .option('repo-dir', {
    alias: 'd',
    description:
      'Path to the runtime repo (where modules will be installed). Env: WORKER_REPO_DIR',
    default: WORKER_REPO_DIR,
  })
  .option('secret', {
    alias: 's',
    description:
      'Worker secret. (comes from WORKER_SECRET by default). Env: WORKER_SECRET',
    default: WORKER_SECRET,
  })
  .option('lightning-public-key', {
    description:
      'Base64-encoded public key. Used to verify run tokens. Env: WORKER_LIGHTNING_PUBLIC_KEY',
    default: WORKER_LIGHTNING_PUBLIC_KEY,
  })
  .option('log', {
    description:
      'Set the log level for stdout (default to info, set to debug for verbose output). Env: WORKER_LOG_LEVEL',
    default: WORKER_LOG_LEVEL || 'debug',
    type: 'string',
  })
  .option('loop', {
    description: 'Disable the claims loop',
    default: true,
    type: 'boolean',
  })
  .option('mock', {
    description: 'Use a mock runtime engine',
    default: false,
    type: 'boolean',
  })
  .option('backoff', {
    description:
      'Claim backoff rules: min/max (in seconds). Env: WORKER_BACKOFF',
    default: WORKER_BACKOFF || '1/10',
  })
  .option('capacity', {
    description: 'max concurrent workers. Env: WORKER_CAPACITY',
    default: WORKER_CAPACITY ? parseInt(WORKER_CAPACITY) : 5,
    type: 'number',
  })
  .option('state-props-to-remove', {
    description:
      'A list of properties to remove from the final state returned by a job. Env: WORKER_STATE_PROPS_TO_REMOVE',
    default: WORKER_STATE_PROPS_TO_REMOVE ?? ['configuration', 'response'],
    type: 'array',
  })
  .option('run-memory', {
    description:
      'Maximum memory allocated to a single run, in mb. Env: WORKER_MAX_RUN_MEMORY_MB',
    type: 'number',
    default: WORKER_MAX_RUN_MEMORY_MB
      ? parseInt(WORKER_MAX_RUN_MEMORY_MB)
      : 500,
  })
  .option('max-run-duration-seconds', {
    alias: 't',
    description:
      'Default run timeout for the server, in seconds. Env: WORKER_MAX_RUN_DURATION_SECONDS',
    type: 'number',
    default: WORKER_MAX_RUN_DURATION_SECONDS || 60 * 5, // 5 minutes
  })
  .parse() as Args;

const logger = createLogger('SRV', { level: args.log });

if (args.lightning === 'mock') {
  args.lightning = 'ws://localhost:8888/worker';
  if (!args.secret) {
    // Set a fake secret to stop the console warning
    args.secret = 'abdefg';
  }
} else if (!args.secret) {
  logger.error('WORKER_SECRET is not set');
  process.exit(1);
}

const [minBackoff, maxBackoff] = args.backoff
  .split('/')
  .map((n: string) => parseInt(n, 10) * 1000);

function engineReady(engine: any) {
  logger.debug('Creating worker server...');

  const workerOptions: ServerOptions = {
    port: args.port,
    lightning: args.lightning,
    logger,
    secret: args.secret,
    noLoop: !args.loop,
    // TODO need to feed this through properly
    backoff: {
      min: minBackoff,
      max: maxBackoff,
    },
    maxWorkflows: args.capacity,
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
