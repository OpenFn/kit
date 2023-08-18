import test from 'ava';
import yargs from 'yargs';

import execute from '../../src/execute/command';

import type { Opts } from '../../src/options';
import { ERROR_MESSAGE_LOG_LEVEL } from '../../src/util/ensure-log-opts';

// Build the execute command and test the options it returns

const cmd = yargs().command(execute);

const parse = (command: string) => cmd.parse(command) as yargs.Arguments<Opts>;

test("execute: jobPath'.'", (t) => {
  const options = parse('execute job.js');
  t.assert(options.jobPath === 'job.js');
});

test('execute: default outputPath to ./output.json', (t) => {
  const options = parse('execute tmp/job.js');
  t.assert(options.outputPath === 'tmp/output.json');
});

test('execute: set outputPath to ./output.json', (t) => {
  const options = parse('execute tmp/job.js -o /result/out.json');
  t.assert(options.outputPath === '/result/out.json');
});

test('execute: log none', (t) => {
  const options = parse('execute job.js --log none');
  t.deepEqual(options.log, { default: 'none', job: 'debug' });
});

test('execute: log default', (t) => {
  const options = parse('execute job.js --log none');
  t.deepEqual(options.log, { default: 'none', job: 'debug' });
});

test('execute: log info', (t) => {
  const options = parse('execute job.js --log info');
  t.deepEqual(options.log, { default: 'info', job: 'debug' });
});

test('execute: log debug', (t) => {
  const options = parse('execute job.js --log debug');
  t.deepEqual(options.log, { default: 'debug', job: 'debug' });
});

// These aren't supposed to be exhaustive, just testing the surface a bit
test('execute: compiler & runtime in debug', (t) => {
  const options = parse('execute job.js --log compiler=debug,runtime=debug');
  t.deepEqual(options.log, {
    default: 'default',
    compiler: 'debug',
    runtime: 'debug',
    job: 'debug',
  });
});

test('execute: log debug by default but job none', (t) => {
  const options = parse('execute job.js --log debug,job=none');
  t.deepEqual(options.log, { default: 'debug', job: 'none' });
});

test("execute: log levels don't have to be at the end of a command", (t) => {
  const options = parse('execute job.js --log debug,job=none --log-json');
  t.deepEqual(options.log, { default: 'debug', job: 'none' });
  t.true(options.logJson);
});

// This will now trigger a process.exit so we can't really test this here
test.skip('execute: throw for invalid log', (t) => {
  t.throws(() => parse('execute job.js --log wibble'), {
    message: ERROR_MESSAGE_LOG_LEVEL,
  });
});

test('execute: log json', (t) => {
  const options = parse('execute job.js --log-json');
  t.true(options.logJson);
});

test('execute: sanitize none (by default)', (t) => {
  const options = parse('execute job.js');
  t.is(options.sanitize, 'none');
});

test('execute: sanitize none (explicit)', (t) => {
  const options = parse('execute job.js --sanitize=none');
  t.is(options.sanitize, 'none');
});

test('execute: sanitize remove ', (t) => {
  const options = parse('execute job.js --sanitize=remove');
  t.is(options.sanitize, 'remove');
});

test('execute: sanitize obfuscate ', (t) => {
  const options = parse('execute job.js --sanitize=obfuscate');
  t.is(options.sanitize, 'obfuscate');
});

test('execute: sanitize summarize ', (t) => {
  const options = parse('execute job.js --sanitize=summarize');
  t.is(options.sanitize, 'summarize');
});
