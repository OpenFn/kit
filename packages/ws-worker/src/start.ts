#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import createLogger, { LogLevel } from '@openfn/logger';

import createRTE from '@openfn/engine-multi';
import createMockRTE from './mock/runtime-engine';
import createWorker from './server';

type Args = {
  _: string[];
  port?: number;
  lightning?: string;
  repoDir?: string;
  secret?: string;
  loop?: boolean;
  log: LogLevel;
  mock: boolean;
  backoff: string;
  capacity?: number;
  runMemory?: number;
  statePropsToRemove?: string[];
};

const {
  BACKOFF,
  CAPACITY,
  LOG_LEVEL,
  MAX_RUN_MEMORY,
  PORT,
  STATE_PROPS_TO_REMOVE,
  WORKER_REPO_DIR,
  WORKER_SECRET,
} = process.env;

const args = yargs(hideBin(process.argv))
  .command('server', 'Start a ws-worker server')
  .option('port', {
    alias: 'p',
    description: 'Port to run the server on',
    type: 'number',
    default: PORT || 2222,
  })
  // TODO maybe this is positional and required?
  // frees up -l for the log
  .option('lightning', {
    alias: 'l',
    description:
      'Base url to Lightning websocket endpoint, eg, ws://localhost:4000/worker. Set to "mock" to use the default mock server',
    default: 'ws://localhost:4000/worker',
  })
  .option('repo-dir', {
    alias: 'd',
    description: 'Path to the runtime repo (where modules will be installed)',
    default: WORKER_REPO_DIR,
  })
  .option('secret', {
    alias: 's',
    description: 'Worker secret (comes from WORKER_SECRET by default)',
  })
  .option('log', {
    description:
      'Set the log level for stdout (default to info, set to debug for verbose output)',
    default: LOG_LEVEL || 'debug',
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
    description: 'Claim backoff rules: min/max (s)',
    default: BACKOFF || '1/10',
  })
  .option('capacity', {
    description: 'max concurrent workers',
    default: CAPACITY ? parseInt(CAPACITY) : 5,
    type: 'number',
  })
  .option('state-props-to-remove', {
    description:
      'A list of properties to remove from the final state returned by a job',
    default: STATE_PROPS_TO_REMOVE ?? ['configuration', 'response'],
    type: 'array',
  })
  .option('run-memory', {
    description: 'Maximum memory allocated to a single run, in mb',
    type: 'number',
    default: MAX_RUN_MEMORY ? parseInt(MAX_RUN_MEMORY) : 500,
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
  if (!WORKER_SECRET) {
    logger.error('WORKER_SECRET is not set');
    process.exit(1);
  }

  args.secret = WORKER_SECRET;
}

const [minBackoff, maxBackoff] = args.backoff
  .split('/')
  .map((n: string) => parseInt(n, 10) * 1000);

function engineReady(engine: any) {
  logger.debug('Creating worker server...');

  const workerOptions = {
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
  const { logger: _l, secret: _s, ...humanOptions } = workerOptions;
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
  };
  logger.debug('Creating runtime engine...');
  logger.debug('Engine options:', engineOptions);

  createRTE(engineOptions).then((engine) => {
    logger.debug('Engine created!');
    engineReady(engine);
  });
}
