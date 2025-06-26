import yargs from 'yargs';
import { LogLevel } from '@openfn/logger';
import { hideBin } from 'yargs/helpers';

const DEFAULT_PORT = 2222;
const DEFAULT_WORKER_CAPACITY = 5;
const DEFAULT_SOCKET_TIMEOUT_SECONDS = 10;
const DEFAULT_MESSAGE_TIMEOUT_SECONDS = 30;

type Args = {
  _: string[];
  backoff: string;
  capacity?: number;
  collectionsUrl?: string;
  collectionsVersion?: string;
  lightning?: string;
  lightningPublicKey?: string;
  log?: LogLevel;
  loop?: boolean;
  maxRunDurationSeconds: number;
  mock?: boolean;
  monorepoDir?: string;
  payloadMemory?: number;
  port?: number;
  repoDir?: string;
  runMemory?: number;
  secret?: string;
  socketTimeoutSeconds?: number;
  messageTimeoutSeconds?: number;
  statePropsToRemove?: string[];
  sentryDsn?: string;
  sentryEnv?: string;
};

type ArgTypes = string | string[] | number | undefined;

function setArg(
  argValue?: ArgTypes,
  envValue?: string,
  defaultValue?: ArgTypes
): ArgTypes {
  if (
    Array.isArray(defaultValue) &&
    !argValue &&
    typeof envValue === 'string'
  ) {
    return envValue.split(',');
  }

  if (typeof defaultValue === 'number' && envValue && !argValue) {
    return parseInt(envValue);
  }

  return argValue ?? envValue ?? defaultValue;
}

export default function parseArgs(argv: string[]): Args {
  const {
    OPENFN_ADAPTORS_REPO,
    WORKER_BACKOFF,
    WORKER_CAPACITY,
    WORKER_COLLECTIONS_URL,
    WORKER_COLLECTIONS_VERSION,
    WORKER_LIGHTNING_PUBLIC_KEY,
    WORKER_LIGHTNING_SERVICE_URL,
    WORKER_LOG_LEVEL,
    WORKER_MAX_PAYLOAD_MB,
    WORKER_MAX_RUN_DURATION_SECONDS,
    WORKER_MAX_RUN_MEMORY_MB,
    WORKER_MESSAGE_TIMEOUT_SECONDS,
    WORKER_PORT,
    WORKER_REPO_DIR,
    WORKER_SECRET,
    WORKER_SENTRY_DSN,
    WORKER_SENTRY_ENV,
    WORKER_SOCKET_TIMEOUT_SECONDS,
    WORKER_STATE_PROPS_TO_REMOVE,
  } = process.env;

  const parser = yargs(hideBin(argv))
    .command('server', 'Start a ws-worker server')
    .option('debug', {
      hidden: true,
      type: 'boolean',
    })
    .option('port', {
      alias: 'p',
      description: `Port to run the server on. Default ${DEFAULT_PORT}. Env: WORKER_PORT`,
      type: 'number',
    })
    .option('lightning', {
      alias: ['l', 'lightning-service-url'],
      description:
        'Base url to Lightning websocket endpoint, eg, ws://localhost:4000/worker. Set to "mock" to use the default mock server. Env: WORKER_LIGHTNING_SERVICE_URL',
    })
    .option('repo-dir', {
      alias: 'd',
      description:
        'Path to the runtime repo (where modules will be installed). Env: WORKER_REPO_DIR',
    })
    .option('monorepo-dir', {
      alias: 'm',
      description:
        'Path to the adaptors monorepo, from where @local adaptors will be loaded. Env: OPENFN_ADAPTORS_REPO',
    })
    .option('secret', {
      alias: 's',
      description:
        'Worker secret. (comes from WORKER_SECRET by default). Env: WORKER_SECRET',
    })
    .option('sentry-dsn', {
      alias: ['dsn'],
      description: 'Sentry DSN. Env: WORKER_SENTRY_DSN',
    })
    .option('sentry-env', {
      description:
        "Sentry environment. Defaults to 'dev'. Env: WORKER_SENTRY_ENV",
    })
    .option('socket-timeout', {
      description: `Timeout for websockets to Lightning, in seconds. Defaults to 10.Env: WORKER_SOCKET_TIMEOUT_SECONDS`,
    })
    .option('message-timeout', {
      description: `Timeout for messages in the run channel in seconds. Defaults to 1. Env: WORKER_MESSAGE_TIMEOUT_SECONDS`,
    })
    .option('lightning-public-key', {
      description:
        'Base64-encoded public key. Used to verify run tokens. Env: WORKER_LIGHTNING_PUBLIC_KEY',
    })
    .option('log', {
      description:
        'Set the log level for stdout (default to info, set to debug for verbose output). Env: WORKER_LOG_LEVEL',
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
      description:
        'Claim backoff rules: min/max (in seconds). Env: WORKER_BACKOFF',
    })
    .option('capacity', {
      description: `max concurrent workers. Default ${DEFAULT_WORKER_CAPACITY}. Env: WORKER_CAPACITY`,
      type: 'number',
    })
    .option('state-props-to-remove', {
      description:
        'A list of properties to remove from the final state returned by a job. Env: WORKER_STATE_PROPS_TO_REMOVE',
      type: 'array',
    })
    .option('run-memory', {
      description:
        'Maximum memory allocated to a single run, in mb. Env: WORKER_MAX_RUN_MEMORY_MB',
      type: 'number',
    })
    .option('payload-memory', {
      description:
        'Maximum memory allocated to a single run, in mb. Env: WORKER_MAX_PAYLOAD_MB',
      type: 'number',
    })
    .option('max-run-duration-seconds', {
      alias: 't',
      description:
        'Default run timeout for the server, in seconds. Env: WORKER_MAX_RUN_DURATION_SECONDS',
      type: 'number',
    })
    .option('collections-url', {
      alias: ['c'],
      description:
        'URL to the Collections service endpoint. Required for Collections, eg, https://app.openfn.org/collections. Env: WORKER_COLLECTIONS_URL',
    })
    .option('collections-version', {
      description:
        'The version of the collections adaptor to use for all runs on this worker instance.Env: WORKER_COLLECTIONS_VERSION',
      type: 'string',
    });

  const args = parser.parse() as Args;
  console.log('---- !!!! ', args.backoff);
  return {
    ...args,
    port: setArg(args.port, WORKER_PORT, DEFAULT_PORT),
    lightning: setArg(
      args.lightning,
      WORKER_LIGHTNING_SERVICE_URL,
      'ws://localhost:4000/worker'
    ),
    repoDir: setArg(args.repoDir, WORKER_REPO_DIR),
    monorepoDir: setArg(args.monorepoDir, OPENFN_ADAPTORS_REPO),
    secret: setArg(args.secret, WORKER_SECRET),
    sentryDsn: setArg(args.sentryDsn, WORKER_SENTRY_DSN),
    sentryEnv: setArg(args.sentryEnv, WORKER_SENTRY_ENV, 'dev'),
    lightningPublicKey: setArg(
      args.lightningPublicKey,
      WORKER_LIGHTNING_PUBLIC_KEY
    ),
    log: setArg(args.log, WORKER_LOG_LEVEL as LogLevel, 'debug'),
    backoff: setArg(args.backoff, WORKER_BACKOFF, '1/10'),
    capacity: setArg(args.capacity, WORKER_CAPACITY, DEFAULT_WORKER_CAPACITY),
    statePropsToRemove: setArg(
      args.statePropsToRemove,
      WORKER_STATE_PROPS_TO_REMOVE,
      ['configuration', 'response']
    ),
    runMemory: setArg(args.runMemory, WORKER_MAX_RUN_MEMORY_MB, 500),
    payloadMemory: setArg(args.payloadMemory, WORKER_MAX_PAYLOAD_MB, 10),
    maxRunDurationSeconds: setArg(
      args.maxRunDurationSeconds,
      WORKER_MAX_RUN_DURATION_SECONDS,
      300
    ),
    socketTimeoutSeconds: setArg(
      args.socketTimeoutSeconds,
      WORKER_SOCKET_TIMEOUT_SECONDS,
      DEFAULT_SOCKET_TIMEOUT_SECONDS
    ),
    messageTimeoutSeconds: setArg(
      args.messageTimeoutSeconds,
      WORKER_MESSAGE_TIMEOUT_SECONDS,
      DEFAULT_MESSAGE_TIMEOUT_SECONDS
    ),
    collectionsVersion: setArg(
      args.collectionsVersion,
      WORKER_COLLECTIONS_VERSION
    ),
    collectionsUrl: setArg(args.collectionsUrl, WORKER_COLLECTIONS_URL),
  } as Args;
}
