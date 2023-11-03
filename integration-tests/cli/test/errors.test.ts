import test from 'ava';
import path from 'node:path';
import run from '../src/run';
import { extractLogs, assertLog } from '../src/util';

const jobsPath = path.resolve('test/fixtures');

// These are all errors that will stop the CLI from even running

test.serial('job not found', async (t) => {
  const { stdout, err } = await run('openfn blah.js --log-json');
  t.is(err.code, 1);

  const stdlogs = extractLogs(stdout);

  assertLog(t, stdlogs, /job not found/i);
  assertLog(t, stdlogs, /failed to load the job from blah.js/i);
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

  assertLog(t, stdlogs, /File not found for job 1: does-not-exist.js/i);
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

  assertLog(t, stdlogs, /Invalid workflow/i);
  assertLog(t, stdlogs, /circular dependency: b <-> a/i);
});

test.serial('multiple inputs', async (t) => {
  const { stdout, err } = await run(
    `openfn ${jobsPath}/multiple-inputs.json --log-json`
  );
  t.is(err.code, 1);

  const stdlogs = extractLogs(stdout);

  assertLog(t, stdlogs, /Invalid workflow/i);
  assertLog(t, stdlogs, /multiple dependencies detected for: c/i);
});

test.serial('invalid start', async (t) => {
  const { stdout, err } = await run(
    `openfn ${jobsPath}/invalid-start.json --log-json`
  );
  t.is(err.code, 1);

  const stdlogs = extractLogs(stdout);

  assertLog(t, stdlogs, /Error validating execution plan/i);
  assertLog(t, stdlogs, /could not find start job: nope/i);
  assertLog(t, stdlogs, /Workflow failed/i);
});
