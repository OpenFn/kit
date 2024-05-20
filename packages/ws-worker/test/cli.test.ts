import test from 'ava';
import { parseArgs } from '../src/cli';
import { LogLevel } from '@openfn/logger';


const resetEnv = (env: NodeJS.ProcessEnv) => {
    process.env = { ...env };
};

test.beforeEach(t => {
    // Store original environment variables
    t.context = { ...process.env };
});

test.afterEach(t => {
    // Restore original environment variables
    resetEnv(t.context as NodeJS.ProcessEnv);
});

test('parseArgs should parse command line arguments correctly', t => {
    const argv = ['node', 'cli.js', '--port', '3000', '--log', 'info', '--max-run-duration-seconds', '120'];
    const args = parseArgs(argv);

    t.is(args.port, 3000);
    t.is(args.log, 'info' as LogLevel);
    t.is(args.maxRunDurationSeconds, 120);
});

test('parseArgs should use environment variables as defaults', t => {
    process.env.WORKER_PORT = '4000';
    process.env.WORKER_LOG_LEVEL = 'error';
    process.env.WORKER_MAX_RUN_DURATION_SECONDS = '180';

    const argv = ['node', 'cli.js'];
    const args = parseArgs(argv);

    t.is(args.port, 4000);
    t.is(args.log, 'error' as LogLevel);
    t.is(args.maxRunDurationSeconds, 180);
});

test('parseArgs should override environment variables with command line arguments', t => {
    process.env.WORKER_PORT = '4000';
    process.env.WORKER_LOG_LEVEL = 'error';
    process.env.WORKER_MAX_RUN_DURATION_SECONDS = '180';
    
    const argv = ['node', 'cli.js', '--port', '5000', '--log', 'debug', '--max-run-duration-seconds', '240'];
    const args = parseArgs(argv);

    t.is(args.port, 5000);
    t.is(args.log, 'debug' as LogLevel);
    t.is(args.maxRunDurationSeconds, 240);
});

test('parseArgs should set default values for unspecified options', t => {
    const argv = ['node', 'cli.js'];
    
    const args = parseArgs(argv);
    
    t.is(args.port, 2222);
    t.is(args.lightning, 'ws://localhost:4000/worker');
    t.is(args.log, 'debug' as LogLevel);
    t.is(args.backoff, '1/10');
    t.is(args.capacity, 5);
    t.deepEqual(args.statePropsToRemove, ['configuration', 'response']);
    t.is(args.runMemory, 500);
    t.is(args.maxRunDurationSeconds, 300);
}); 

test('parseArgs should handle boolean options correctly', t => {
    const argv = ['node', 'cli.js', '--loop', 'false', '--mock', 'true'];
    const args = parseArgs(argv);

    t.is(args.loop, false);
    t.is(args.mock, true);
});

test('parseArgs should handle array options correctly', t => {
    const argv = ['node', 'cli.js', '--state-props-to-remove', 'prop1', 'prop2', 'prop3'];
    const args = parseArgs(argv);

    t.deepEqual(args.statePropsToRemove, ['prop1', 'prop2', 'prop3']);
});
