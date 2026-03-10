import test from 'ava';
import cli from '../../src/util/cli';
import { LogLevel } from '@openfn/logger';

test.beforeEach(() => {
  // Don't let local environment interfere with tests
  process.env = {};
});

test('cli should parse command line arguments correctly', (t) => {
  const argv =
    'pnpm start --port 3000 --log info --max-run-duration-seconds 120'.split(
      ' '
    );
  const args = cli(argv);

  t.is(args.port, 3000);
  t.is(args.log, 'info' as LogLevel);
  t.is(args.maxRunDurationSeconds, 120);
});

test('cli should use environment variables as defaults', (t) => {
  process.env.WORKER_PORT = '4000';
  process.env.WORKER_LOG_LEVEL = 'error';
  process.env.WORKER_MAX_RUN_DURATION_SECONDS = '180';

  const argv = 'pnpm start'.split(' ');
  const args = cli(argv);

  t.is(args.port, 4000);
  t.is(args.log, 'error' as LogLevel);
  t.is(args.maxRunDurationSeconds, 180);
});

test('cli should override environment variables with command line arguments', (t) => {
  process.env.WORKER_PORT = '4000';
  process.env.WORKER_LOG_LEVEL = 'error';
  process.env.WORKER_MAX_RUN_DURATION_SECONDS = '180';

  const argv =
    'pnpm start --port 5000 --log debug --max-run-duration-seconds 240'.split(
      ' '
    );
  const args = cli(argv);

  t.is(args.port, 5000);
  t.is(args.log, 'debug' as LogLevel);
  t.is(args.maxRunDurationSeconds, 240);
});

test('cli should set default values for unspecified options', (t) => {
  const argv = 'pnpm start'.split(' ');

  const args = cli(argv);

  t.is(args.port, 2222);
  t.is(args.lightning, 'ws://localhost:4000/worker');
  t.is(args.log, 'debug' as LogLevel);
  t.is(args.backoff, '1/10');
  t.is(args.capacity, 5);
  t.is(args.sentryEnv, 'dev');
  t.falsy(args.sentryDsn);
  t.deepEqual(args.statePropsToRemove, ['configuration', 'response']);
  t.is(args.runMemory, 500);
  t.is(args.maxRunDurationSeconds, 300);
  t.is(args.engineValidationRetries, 3);
  t.is(args.engineValidationTimeoutMs, 5000);
  t.is(args.profile, false);
  t.is(args.profilePollIntervalMs, 10);
});

test('cli should handle boolean options correctly', (t) => {
  const argv = 'pnpm start --loop false --mock true'.split(' ');
  const args = cli(argv);

  t.is(args.loop, false);
  t.is(args.mock, true);
});

test('cli should configure sentry directly', (t) => {
  const argv = 'pnpm start --sentry-dsn abc --sentry-env local'.split(' ');
  const args = cli(argv);

  t.is(args.sentryDsn, 'abc');
  t.is(args.sentryEnv, 'local');
});

test('cli should configure sentry through env vars', (t) => {
  process.env.WORKER_SENTRY_DSN = 'abc';
  process.env.WORKER_SENTRY_ENV = 'local';
  const argv = 'pnpm start'.split(' ');
  const args = cli(argv);

  t.is(args.sentryDsn, 'abc');
  t.is(args.sentryEnv, 'local');
});

test('cli should handle array options correctly', (t) => {
  const argv = 'pnpm start --state-props-to-remove prop1 prop2 prop3'.split(
    ' '
  );
  process.env.WORKER_STATE_PROPS_TO_REMOVE = 'prop4,prop5,prop6';
  const args = cli(argv);

  t.deepEqual(args.statePropsToRemove, ['prop1', 'prop2', 'prop3']);
});

test('cli should handle array options correctly for env variables', (t) => {
  process.env.WORKER_STATE_PROPS_TO_REMOVE = 'prop1,prop2,prop3';

  const argv = 'pnpm start'.split(' ');
  const args = cli(argv);

  t.deepEqual(args.statePropsToRemove, ['prop1', 'prop2', 'prop3']);
});

test('cli should configure engine validation through env vars', (t) => {
  process.env.WORKER_VALIDATION_RETRIES = '22';
  process.env.WORKER_VALIDATION_TIMEOUT_MS = '3333';

  const argv = 'pnpm start'.split(' ');
  const args = cli(argv);

  t.is(args.engineValidationRetries, 22);
  t.is(args.engineValidationTimeoutMs, 3333);
});

test('cli should configure engine validation through args', (t) => {
  const retries = '22';
  const timeout = '3333';
  const argv =
    `pnpm start --engine-validation-timeout-ms ${timeout} --engine-validation-retries ${retries}`.split(
      ' '
    );
  const args = cli(argv);

  t.is(args.engineValidationRetries, 22);
  t.is(args.engineValidationTimeoutMs, 3333);
});

// --queues option tests

test('cli should parse --queues from CLI', (t) => {
  const argv = ['pnpm', 'start', '--queues', 'fast_lane:1 manual,*:4'];
  const args = cli(argv);
  t.is(args.queues, 'fast_lane:1 manual,*:4');
});

test('cli should pick up WORKER_QUEUES env var', (t) => {
  process.env.WORKER_QUEUES = '*:5';
  const argv = 'pnpm start'.split(' ');
  const args = cli(argv);
  t.is(args.queues, '*:5');
});

test('cli --queues should override WORKER_QUEUES env var', (t) => {
  process.env.WORKER_QUEUES = '*:5';
  const argv = ['pnpm', 'start', '--queues', 'fast_lane:1'];
  const args = cli(argv);
  t.is(args.queues, 'fast_lane:1');
});

test('cli queues should be undefined when not set', (t) => {
  const argv = 'pnpm start'.split(' ');
  const args = cli(argv);
  t.is(args.queues, undefined);
});

test('cli should throw when --capacity and --queues are both set', (t) => {
  const argv = ['pnpm', 'start', '--capacity', '3', '--queues', '*:5'];
  const err = t.throws(() => cli(argv));
  t.true(err?.message.includes('mutually exclusive'));
});

test('cli should throw when WORKER_CAPACITY and --queues are both set', (t) => {
  process.env.WORKER_CAPACITY = '3';
  const argv = ['pnpm', 'start', '--queues', '*:5'];
  const err = t.throws(() => cli(argv));
  t.true(err?.message.includes('mutually exclusive'));
});

test('cli should throw when WORKER_QUEUES and --capacity are both set', (t) => {
  process.env.WORKER_QUEUES = '*:5';
  const argv = ['pnpm', 'start', '--capacity', '3'];
  const err = t.throws(() => cli(argv));
  t.true(err?.message.includes('mutually exclusive'));
});

test('cli should throw when WORKER_QUEUES and WORKER_CAPACITY are both set as env vars', (t) => {
  process.env.WORKER_QUEUES = '*:5';
  process.env.WORKER_CAPACITY = '3';
  const argv = 'pnpm start'.split(' ');
  const err = t.throws(() => cli(argv));
  t.true(err?.message.includes('mutually exclusive'));
});

test('cli should work with only --queues (no capacity)', (t) => {
  const argv = ['pnpm', 'start', '--queues', '*:5'];
  const args = cli(argv);
  t.is(args.queues, '*:5');
  t.is(args.capacity, 5); // default still applied
});

test('cli should work with only --capacity (no queues)', (t) => {
  const argv = 'pnpm start --capacity 3'.split(' ');
  const args = cli(argv);
  t.is(args.capacity, 3);
  t.is(args.queues, undefined);
});

// pnpm v7+ passes '--' through to process.argv
test('cli should strip leading -- from pnpm passthrough', (t) => {
  const argv = [
    'node',
    'start.ts',
    '--',
    '--queues',
    'fast_lane:2 *:3',
    '--log',
    'info',
  ];
  const args = cli(argv);
  t.is(args.queues, 'fast_lane:2 *:3');
  t.is(args.log, 'info');
});
