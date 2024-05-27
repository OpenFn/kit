import test from 'ava';
import cli from '../../src/util/cli';
import { LogLevel } from '@openfn/logger';

test.beforeEach((t) => {
  // Store original environment variables
  t.context = { ...process.env };
});

test.afterEach((t) => {
  // Restore original environment variables
  process.env = { ...(t.context as NodeJS.ProcessEnv) };
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
  t.deepEqual(args.statePropsToRemove, ['configuration', 'response']);
  t.is(args.runMemory, 500);
  t.is(args.maxRunDurationSeconds, 300);
});

test('cli should handle boolean options correctly', (t) => {
  const argv = 'pnpm start --loop false --mock true'.split(' ');
  const args = cli(argv);

  t.is(args.loop, false);
  t.is(args.mock, true);
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
  const argv = 'pnpm start'.split(' ');
  process.env.WORKER_STATE_PROPS_TO_REMOVE = 'prop1,prop2,prop3';
  const args = cli(argv);

  t.deepEqual(args.statePropsToRemove, ['prop1', 'prop2', 'prop3']);
});
