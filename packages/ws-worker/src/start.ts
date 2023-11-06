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
};

const args = yargs(hideBin(process.argv))
  .command('server', 'Start a ws-worker server')
  .option('port', {
    alias: 'p',
    description: 'Port to run the server on',
    type: 'number',
    default: 2222,
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
  })
  .option('secret', {
    alias: 's',
    description: 'Worker secret (comes from WORKER_SECRET by default)',
  })
  .option('log', {
    description: 'Worker secret (comes from WORKER_SECRET by default)',
    default: 'info',
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
    description: 'Claim backoff rules: min/max (ms)',
    default: '1000/10000',
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
  const { WORKER_SECRET } = process.env;
  if (!WORKER_SECRET) {
    logger.error('WORKER_SECRET is not set');
    process.exit(1);
  }

  args.secret = WORKER_SECRET;
}
const [minBackoff, maxBackoff] = args.backoff
  .split('/')
  .map((n: string) => parseInt(n, 10));

function engineReady(engine: any) {
  createWorker(engine, {
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
  });
}

if (args.mock) {
  createMockRTE().then((engine) => {
    logger.debug('Mock engine created');
    engineReady(engine);
  });
} else {
  createRTE({ repoDir: args.repoDir }).then((engine) => {
    logger.debug('engine created');
    engineReady(engine);
  });
}
