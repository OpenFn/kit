// start the server in a local CLI
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import createLogger from '@openfn/logger';

// import createRTM from '@openfn/runtime-engine';
import createMockRTE from './mock/runtime-engine';
import createWorker from './server';

type Args = {
  _: string[];
  port?: number;
  lightning?: string;
  repoDir?: string;
  secret?: string;
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
      'Base url to Lightning websocket endpoint, eg, ws://locahost:4000/worker. Set to "mock" to use the default mock server',
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
  .parse() as Args;

const logger = createLogger('SRV', { level: args.log });

if (args.lightning === 'mock') {
  args.lightning = 'ws://localhost:8888/worker';
} else if (!args.secret) {
  const { WORKER_SECRET } = process.env;
  if (!WORKER_SECRET) {
    logger.error('WORKER_SECRET is not set');
    process.exit(1);
  }

  args.secret = WORKER_SECRET;
}

// TODO the engine needs to take callbacks to load credential, and load state
// these in turn should utilise the websocket
// So either the server creates the runtime (which seems reasonable acutally?)
// Or the server calls a setCalbacks({ credential, state }) function on the engine
// Each of these takes the attemptId as the firsdt argument
// credential and state will lookup the right channel
// const engine = createEngine('rte', { repoDir: args.repoDir });
// logger.debug('engine created');

// use the mock rtm for now
const engine = createMockRTE('rtm');
logger.debug('Mock RTM created');

createWorker(engine, {
  port: args.port,
  lightning: args.lightning,
  logger,
  secret: args.secret,
});
