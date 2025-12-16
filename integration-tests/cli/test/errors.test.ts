import test from 'ava';
import path from 'node:path';
import run from '../src/run';
import { extractLogs, assertLog } from '../src/util';

const jobsPath = path.resolve('test/fixtures');

const extractErrorLogs = (stdout) => {
  const stdlogs = extractLogs(stdout);
  return stdlogs
    .filter((e) => e.level === 'error')
    .map((e) => e.message.join(' ').replace(/\(\d+ms\)/, '(SSSms)'))
    .filter((e) => e.length);
};

// These are all errors that will stop the CLI from even running

test.serial('expression not found', async (t) => {
  const { stdout, err } = await run('openfn blah.js --log-json');
  t.is(err.code, 1);

  const stdlogs = extractLogs(stdout);
  assertLog(t, stdlogs, /expression not found/i);
  assertLog(t, stdlogs, /failed to load the expression from blah.js/i);
  assertLog(t, stdlogs, /critical error: aborting command/i);
});

test.serial('workflow not found', async (t) => {
  const { stdout, err } = await run('openfn blah.json --log-json');
  t.is(err.code, 1);

  const stdlogs = extractLogs(stdout);

  assertLog(t, stdlogs, /workflow not found/i);
  assertLog(t, stdlogs, /failed to load a workflow from blah.json/i);
  assertLog(t, stdlogs, /critical error: aborting command/i);
});

test.serial('job contains invalid js', async (t) => {
  const { stdout, err } = await run(`openfn ${jobsPath}/invalid.js --log-json`);
  t.is(err.code, 1);

  const stdlogs = extractLogs(stdout);

  assertLog(t, stdlogs, /failed to compile job/i);
  assertLog(t, stdlogs, /unexpected token \(2:10\)/i);
  assertLog(t, stdlogs, /check the syntax of the job expression/i);
  assertLog(t, stdlogs, /critical error: aborting command/i);
});

// TODO this should really mention which job threw the error
test.serial('workflow references a job with invalid js', async (t) => {
  const { stdout, err } = await run(
    `openfn ${jobsPath}/invalid-syntax.json --log-json`
  );
  t.is(err.code, 1);

  const stdlogs = extractLogs(stdout);

  assertLog(t, stdlogs, /failed to compile job/i);
  assertLog(t, stdlogs, /unexpected token \(2:10\)/i);
  assertLog(t, stdlogs, /check the syntax of the job expression/i);
  assertLog(t, stdlogs, /critical error: aborting command/i);
});

test.serial("can't find an expression referenced in a workflow", async (t) => {
  const { stdout, err } = await run(
    `openfn ${jobsPath}/invalid-exp-path.json --log-json`
  );
  t.is(err.code, 1);

  const stdlogs = extractLogs(stdout);

  assertLog(t, stdlogs, /File not found for job 1: does-not-exist.js/i);
  assertLog(
    t,
    stdlogs,
    /This workflow references a file which cannot be found at does-not-exist.js/i
  );
  assertLog(t, stdlogs, /critical error: aborting command/i);
});

test.serial("can't find config referenced in a workflow", async (t) => {
  const { stdout, err } = await run(
    `openfn ${jobsPath}/invalid-config-path.json --log-json`
  );
  t.is(err.code, 1);

  const stdlogs = extractLogs(stdout);

  assertLog(
    t,
    stdlogs,
    /File not found for job configuration 1: does-not-exist.js/i
  );
  assertLog(
    t,
    stdlogs,
    /This workflow references a file which cannot be found at does-not-exist.js/i
  );
  assertLog(t, stdlogs, /critical error: aborting command/i);
});

test.serial('circular workflow', async (t) => {
  const { stdout, err } = await run(
    `openfn ${jobsPath}/circular.json --log-json`
  );
  t.is(err.code, 1);

  const stdlogs = extractLogs(stdout);

  assertLog(t, stdlogs, /Error validating execution plan/i);
  assertLog(t, stdlogs, /Workflow failed/i);

  const error = stdlogs.find((l) => l.message[0].name === 'ValidationError');
  t.regex(error.message[0].message, /circular dependency: b <-> a/i);
});

test.serial('invalid start on workflow (not found)', async (t) => {
  const { stdout, err } = await run(
    `openfn ${jobsPath}/invalid-start.json --log-json`
  );
  t.is(err.code, 1);

  const stdlogs = extractLogs(stdout);

  assertLog(t, stdlogs, /Error validating execution plan/i);
  assertLog(t, stdlogs, /aborting/i);

  const error = stdlogs.find((l) => l.message[0].name === 'ValidationError');
  t.regex(error.message[0].message, /Could not find start job: nope/i);
});

test.serial('invalid end (ambiguous)', async (t) => {
  // Note that the start should override
  const { stdout, err } = await run(
    `openfn ${jobsPath}/invalid-start.json --log-json --start x1 --end x`
  );
  t.is(err.code, 1);

  const stdlogs = extractLogs(stdout);

  assertLog(t, stdlogs, /Error: end pattern matched multiple steps/i);
  assertLog(t, stdlogs, /aborting/i);
});

// These test error outputs within valid workflows

test.serial.only('job with reference error', async (t) => {
  const { stdout, err } = await run(
    `openfn ${jobsPath}/errors.json --log-json --start ref --no-cache-steps`
  );

  const logs = extractErrorLogs(stdout);
  t.log(logs);

  t.deepEqual(logs, [
    'ref aborted with error (SSSms)',
    `TypeError: Cannot read properties of undefined (reading 'y')
    at vm:module(0):1:23
    @openfn/language-common_2.1.1/dist/index.cjs:333:12`,
    'Error occurred at: ref',
    '1: fn((state) => state.x.y)',
    '                         ^ ',
    'Check state.errors.ref for details',
  ]);
});

test.serial('job with not a function error', async (t) => {
  const { stdout, err } = await run(
    `openfn ${jobsPath}/errors.json --log-json --start not-function --no-cache-steps`
  );

  const logs = extractErrorLogs(stdout);
  t.log(logs);

  t.deepEqual(logs, [
    'not-function aborted with error (SSSms)',
    `TypeError: state is not a function
    at vm:module(0):1:15
    @openfn/language-common_2.1.1/dist/index.cjs:333:12`,
    'Error occurred at: not-function',
    '1: fn((state) => state())',
    '                 ^       ',
    'Check state.errors.not-function for details',
  ]);
});

test.serial('job with assign-to-const error', async (t) => {
  const { stdout, err } = await run(
    `openfn ${jobsPath}/errors.json --log-json --start assign-const --no-cache-steps`
  );

  const logs = extractErrorLogs(stdout);
  t.log(logs);

  t.deepEqual(logs, [
    'assign-const aborted with error (SSSms)',
    `TypeError: Assignment to constant variable.
    at vm:module(0):1:33
    @openfn/language-common_2.1.1/dist/index.cjs:333:12`,
    'Error occurred at: assign-const',
    '1: fn((state) => {  const x = 10; x = 20; })',
    '                                   ^        ',
    'Check state.errors.assign-const for details',
  ]);
});
