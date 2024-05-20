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

function setArg<T>(argValue: T | undefined, envValue: string | undefined, defaultValue: T): T {
  if (Array.isArray(defaultValue) && envValue !== undefined && argValue == undefined) {
    return (envValue.split(',') as unknown) as T;
  }

  if (typeof defaultValue === 'number' && envValue !== undefined && argValue == undefined) {
    return parseInt(envValue) as unknown as T;
  }

  return argValue ?? (envValue as unknown as T) ?? defaultValue;
}

export function parseArgs(argv: string[]): Args {
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
      description: 'Port to run the server on.',
      type: 'number',
    })
    .option('lightning', {
      alias: ['l', 'lightning-service-url'],
      description: 'Base url to Lightning websocket endpoint, eg, ws://localhost:4000/worker. Set to "mock" to use the default mock server.',
    })
    .option('repo-dir', {
      alias: 'd',
      description: 'Path to the runtime repo (where modules will be installed).',
    })
    .option('secret', {
      alias: 's',
      description: 'Worker secret.',
    })
    .option('lightning-public-key', {
      description: 'Base64-encoded public key. Used to verify run tokens.',
    })
    .option('log', {
      description: 'Set the log level for stdout (default to info, set to debug for verbose output).',
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
      description: 'Claim backoff rules: min/max (in seconds).',
    })
    .option('capacity', {
      description: 'max concurrent workers.',
      type: 'number',
    })
    .option('state-props-to-remove', {
      description: 'A list of properties to remove from the final state returned by a job.',
      type: 'array',
    })
    .option('run-memory', {
      description: 'Maximum memory allocated to a single run, in mb.',
      type: 'number',
    })
    .option('max-run-duration-seconds', {
      alias: 't',
      description: 'Default run timeout for the server, in seconds.',
      type: 'number',
    });

  const args = parser.parse() as Args;

  return {
    ...args,
    port: setArg(args.port, WORKER_PORT, 2222),
    lightning: setArg(args.lightning, WORKER_LIGHTNING_SERVICE_URL, 'ws://localhost:4000/worker'),
    repoDir: setArg(args.repoDir, WORKER_REPO_DIR, undefined),
    secret: setArg(args.secret, WORKER_SECRET, undefined),
    lightningPublicKey: setArg(args.lightningPublicKey, WORKER_LIGHTNING_PUBLIC_KEY, undefined),
    log: setArg(args.log, WORKER_LOG_LEVEL as LogLevel, 'debug'),
    backoff: setArg(args.backoff, WORKER_BACKOFF, '1/10'),
    capacity: setArg(args.capacity, WORKER_CAPACITY, 5),
    statePropsToRemove: setArg(args.statePropsToRemove, WORKER_STATE_PROPS_TO_REMOVE, ['configuration', 'response']),
    runMemory: setArg(args.runMemory, WORKER_MAX_RUN_MEMORY_MB, 500),
    maxRunDurationSeconds: setArg(args.maxRunDurationSeconds, WORKER_MAX_RUN_DURATION_SECONDS, 300),
  } as Args;
}
