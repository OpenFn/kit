import yargs from 'yargs';
import { LogLevel } from '@openfn/logger';
import { hideBin } from 'yargs/helpers';
import {
  DEFAULT_CLAIM_TIMEOUT_SECONDS,
  DEFAULT_MESSAGE_TIMEOUT_SECONDS,
} from '../channels/worker-queue';

const DEFAULT_PORT = 2222;
const DEFAULT_WORKER_CAPACITY = 5;

type Args = {
  _: string[];
  backoff: string;
  batchInterval?: number;
  batchLimit?: number;
  batchLogs: boolean;
  capacity?: number;
  claimTimeoutSeconds?: number;
  collectionsUrl?: string;
  collectionsVersion?: string;
  debug?: boolean;
  engineValidationRetries?: number;
  engineValidationTimeoutMs?: number;
  lightning?: string;
  lightningPublicKey?: string;
  log?: LogLevel;
  logPayloadMemory?: number;
  loop?: boolean;
  maxRunDurationSeconds: number;
  messageTimeoutSeconds?: number;
  mock?: boolean;
  monorepoDir?: string;
  payloadMemory?: number;
  port?: number;
  profile?: boolean;
  profilePollIntervalMs?: number;
  repoDir?: string;
  runMemory?: number;
  secret?: string;
  sentryDsn?: string;
  sentryEnv?: string;
  socketTimeoutSeconds?: number; // deprecated
  statePropsToRemove?: string[];
  timeoutRetryCount?: number;
  timeoutRetryDelayMs?: number;
};

type ArgTypes = string | string[] | number | boolean | undefined;

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

  if (typeof defaultValue === 'boolean' && envValue && argValue === undefined) {
    return envValue === 'true' || envValue === '1';
  }

  return argValue ?? envValue ?? defaultValue;
}

export default function parseArgs(argv: string[]): Args {
  const {
    OPENFN_ADAPTORS_REPO,
    WORKER_BACKOFF,
    WORKER_BATCH_INTERVAL,
    WORKER_BATCH_LIMIT,
    WORKER_BATCH_LOGS,
    WORKER_CAPACITY,
    WORKER_CLAIM_TIMEOUT_SECONDS,
    WORKER_COLLECTIONS_URL,
    WORKER_COLLECTIONS_VERSION,
    WORKER_LIGHTNING_PUBLIC_KEY,
    WORKER_LIGHTNING_SERVICE_URL,
    WORKER_LOG_LEVEL,
    WORKER_MAX_PAYLOAD_MB,
    WORKER_MAX_LOG_PAYLOAD_MB,
    WORKER_MAX_RUN_DURATION_SECONDS,
    WORKER_MAX_RUN_MEMORY_MB,
    WORKER_MESSAGE_TIMEOUT_SECONDS,
    WORKER_PORT,
    WORKER_PROFILE_POLL_INTERVAL_MS,
    WORKER_PROFILE,
    WORKER_REPO_DIR,
    WORKER_SECRET,
    WORKER_SENTRY_DSN,
    WORKER_SENTRY_ENV,
    WORKER_SOCKET_TIMEOUT_SECONDS,
    WORKER_STATE_PROPS_TO_REMOVE,
    WORKER_TIMEOUT_RETRY_COUNT,
    WORKER_TIMEOUT_RETRY_DELAY_MS,
    WORKER_VALIDATION_RETRIES,
    WORKER_VALIDATION_TIMEOUT_MS,
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
      description: `[deprecated] Timeout for websockets to Lightning, in seconds. Defaults to 10.Env: WORKER_SOCKET_TIMEOUT_SECONDS`,
      hidden: true,
    })
    .option('message-timeout', {
      description: `Timeout for all messages send to lightning via websocket. Defaults to 30. Env: WORKER_MESSAGE_TIMEOUT_SECONDS`,
    })
    .option('claim-timeout', {
      description: `Timeout for claim requests for new Runs. This should be set to a high value or else runs may be lost. Defaults to 3600 (1 hour). Env: WORKER_CLAIM_TIMEOUT_SECONDS`,
    })
    .option('lightning-public-key', {
      description:
        'Base64-encoded public key. Used to verify run tokens. Env: WORKER_LIGHTNING_PUBLIC_KEY',
    })
    .option('log', {
      description:
        'Set the log level for stdout (default to info, set to debug for verbose output). Env: WORKER_LOG_LEVEL',
    })
    .option('log-payload-memory', {
      description:
        'Maximum memory allocated to log payloads, in mb. Env: WORKER_MAX_LOG_PAYLOAD_MB',
      type: 'number',
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
    .option('batch-logs', {
      description:
        'Allow logs emitted from the server to be batched up. Env: WORKER_BATCH_LOGS',
      type: 'boolean',
    })
    .option('batch-interval', {
      description:
        'Interval for batching logs, in milliseconds. Env: WORKER_BATCH_INTERVAL',
      type: 'number',
    })
    .option('batch-limit', {
      description:
        'Maximum number of logs to batch before sending. Env: WORKER_BATCH_LIMIT',
      type: 'number',
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
    })
    .option('engine-validation-timeout-ms', {
      description:
        'The timeout used to run the validation task within the engine, in milliseconds. Env: WORKER_VALIDATION_TIMEOUT_MS',
      type: 'number',
    })
    .option('engine-validation-retries', {
      description:
        'The number of times to retry engine validation. Useful in hosted environments. Default 3. ENV: WORKER_VALIDATION_RETRIES',
      type: 'number',
    })
    .option('profile', {
      description:
        'Enable profiling for runs. Default false. Env: WORKER_PROFILE',
      type: 'boolean',
    })
    .option('profile-poll-interval-ms', {
      description:
        'Interval for polling profile data, in milliseconds. Default 10. Env: WORKER_PROFILE_POLL_INTERVAL_MS',
      type: 'number',
    })
    .option('timeout-retry-count', {
      description:
        'When a websocket event receives a timeout, this option sets how many times the worker should retry it. Default 10. Env: WORKER_TIMEOUT_RETRY_COUNT',
      type: 'number',
    })
    .option('timeout-retry-delay', {
      description:
        'When a websocket event receives a timeout, this option sets how log to wait before retrying Default 30000. Env: WORKER_TIMEOUT_RETRY_DELAY_MS',
      type: 'number',
    });

  const args = parser.parse() as Args;
  return {
    ...args,
    port: setArg(args.port, WORKER_PORT, DEFAULT_PORT),
    lightning: setArg(
      args.lightning,
      WORKER_LIGHTNING_SERVICE_URL,
      'ws://localhost:4000/worker'
    ),
    repoDir: setArg(args.repoDir, WORKER_REPO_DIR),
    batchLogs: setArg(args.batchLogs, WORKER_BATCH_LOGS, false),
    batchInterval: setArg(args.batchInterval, WORKER_BATCH_INTERVAL, 10),
    batchLimit: setArg(args.batchLimit, WORKER_BATCH_LIMIT, 50),
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
    logPayloadMemory: setArg(
      args.logPayloadMemory,
      WORKER_MAX_LOG_PAYLOAD_MB,
      1
    ),
    maxRunDurationSeconds: setArg(
      args.maxRunDurationSeconds,
      WORKER_MAX_RUN_DURATION_SECONDS,
      300
    ),
    claimTimeoutSeconds: setArg(
      args.claimTimeoutSeconds,
      WORKER_CLAIM_TIMEOUT_SECONDS,
      DEFAULT_CLAIM_TIMEOUT_SECONDS
    ),
    socketTimeoutSeconds: setArg(
      args.socketTimeoutSeconds,
      WORKER_SOCKET_TIMEOUT_SECONDS
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
    engineValidationRetries: setArg(
      args.engineValidationRetries,
      WORKER_VALIDATION_RETRIES,
      3
    ),
    engineValidationTimeoutMs: setArg(
      args.engineValidationTimeoutMs,
      WORKER_VALIDATION_TIMEOUT_MS,
      5000
    ),
    profile: setArg(args.profile, WORKER_PROFILE, false),
    profilePollIntervalMs: setArg(
      args.profilePollIntervalMs,
      WORKER_PROFILE_POLL_INTERVAL_MS,
      10
    ),
    timeoutRetryCount: setArg(
      args.timeoutRetryCount,
      WORKER_TIMEOUT_RETRY_COUNT,
      10
    ),
    timeoutRetryDelayMs: setArg(
      args.timeoutRetryDelayMs,
      WORKER_TIMEOUT_RETRY_DELAY_MS,
      30 * 1000
    ),
  } as Args;
}
