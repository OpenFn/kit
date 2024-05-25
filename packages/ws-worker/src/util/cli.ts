import yargs from 'yargs';
import { LogLevel } from '@openfn/logger';
import { hideBin } from 'yargs/helpers';

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

function setArg<T>(argValue?: T, envValue?: string, defaultValue?: T): T | undefined {
  if (Array.isArray(defaultValue) && envValue !== undefined && argValue == undefined) {
    return (envValue.split(',')) as T;
  }

  if (typeof defaultValue === 'number' && envValue !== undefined && argValue == undefined) {
    return parseInt(envValue) as T;
  }

  return argValue ?? (envValue as T) ?? defaultValue;
}

export default function parseArgs(argv: string[]): Args {
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

  const parser = yargs(hideBin(argv))
    .command('server', 'Start a ws-worker server')
    .option('port', {
      alias: 'p',
      description: 'Port to run the server on. Env: WORKER_PORT',
      type: 'number',
    })
    .option('lightning', {
      alias: ['l', 'lightning-service-url'],
      description: 'Base url to Lightning websocket endpoint, eg, ws://localhost:4000/worker. Set to "mock" to use the default mock server. Env: WORKER_LIGHTNING_SERVICE_URL',
    })
    .option('repo-dir', {
      alias: 'd',
      description: 'Path to the runtime repo (where modules will be installed). Env: WORKER_REPO_DIR',
    })
    .option('secret', {
      alias: 's',
      description: 'Worker secret. (comes from WORKER_SECRET by default). Env: WORKER_SECRET',
    })
    .option('lightning-public-key', {
      description: 'Base64-encoded public key. Used to verify run tokens. Env: WORKER_LIGHTNING_PUBLIC_KEY',
    })
    .option('log', {
      description: 'Set the log level for stdout (default to info, set to debug for verbose output). Env: WORKER_LOG_LEVEL',
    })
    .option('loop', {
      description: 'Disable the claims loop',
      type: 'boolean',
      default: true,
    })
    .option('mock', {
      description: 'Use a mock runtime engine',
      type: 'boolean',
      default: false,
    })
    .option('backoff', {
      description: 'Claim backoff rules: min/max (in seconds). Env: WORKER_BACKOFF',
    })
    .option('capacity', {
      description: 'max concurrent workers. Env: WORKER_CAPACITY',
      type: 'number',
    })
    .option('state-props-to-remove', {
      description: 'A list of properties to remove from the final state returned by a job. Env: WORKER_STATE_PROPS_TO_REMOVE',
      type: 'array',
    })
    .option('run-memory', {
      description: 'Maximum memory allocated to a single run, in mb. Env: WORKER_MAX_RUN_MEMORY_MB',
      type: 'number',
    })
    .option('max-run-duration-seconds', {
      alias: 't',
      description: 'Default run timeout for the server, in seconds. Env: WORKER_MAX_RUN_DURATION_SECONDS',
      type: 'number',
    });

  const args = parser.parse() as Args;

  return {
    ...args,
    port: setArg(args.port, WORKER_PORT, 2222),
    lightning: setArg(args.lightning, WORKER_LIGHTNING_SERVICE_URL, 'ws://localhost:4000/worker'),
    repoDir: setArg(args.repoDir, WORKER_REPO_DIR),
    secret: setArg(args.secret, WORKER_SECRET),
    lightningPublicKey: setArg(args.lightningPublicKey, WORKER_LIGHTNING_PUBLIC_KEY),
    log: setArg(args.log, WORKER_LOG_LEVEL as LogLevel, 'debug'),
    backoff: setArg(args.backoff, WORKER_BACKOFF, '1/10'),
    capacity: setArg(args.capacity, WORKER_CAPACITY, 5),
    statePropsToRemove: setArg(args.statePropsToRemove, WORKER_STATE_PROPS_TO_REMOVE, ['configuration', 'response']),
    runMemory: setArg(args.runMemory, WORKER_MAX_RUN_MEMORY_MB, 500),
    maxRunDurationSeconds: setArg(args.maxRunDurationSeconds, WORKER_MAX_RUN_DURATION_SECONDS, 300),
  } as Args;
}
