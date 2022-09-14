import test from 'ava';
import path from 'node:path';
import mock from 'mock-fs';
import fs from 'node:fs/promises';

import { cmd } from '../src/cli';
import execute, { Opts } from '../src/execute';

test.afterEach(() => {
  mock.restore();
})

const JOB_EXPORT_42 = 'export default [() => 42];'
const JOB_TIMES_2 = 'export default [(state) => state * 2];'
const JOB_MOCK_ADAPTOR = 'import timesTwo from "times-two"; export default [timesTwo];'

type RunOptions = {
  jobPath?: string;
  statePath?: string;
  outputPath?: string;
  state?: any;
}

// Helper function to mock a file system with particular paths and values,
// then run the CLI against it
async function run(command: string, job: string, options: RunOptions = {}) {
  const jobPath = options.jobPath || "test-job.js";
  const statePath = options.statePath || "state.json";
  const outputPath = options.outputPath || "output.json";
  const state = JSON.stringify(options.state) || '{ "data": {}, "configuration": {} }';
  
  // Ensure that pnpm is not mocked out
  // This is needed to ensure that pnpm dependencies can be dynamically loaded
  // (for recast in particular)
  const pnpm = path.resolve('../../node_modules/.pnpm')

  // Mock the file system in-memory
  mock({
    [jobPath]: job,
    [statePath]: state,
    [outputPath]: '{}',
    [pnpm]: mock.load(pnpm, {}),
    // enable us to load test modules through the mock
    '/modules/': mock.load(path.resolve('test/__modules__/'), {})
  })

  const opts = cmd.parse(command) as Opts;
  opts.silent = true; // disable logging
  await execute(jobPath, opts);
  
  // read the mock output
  return fs.readFile(outputPath, 'utf8');
}

test.serial('run a job with defaults: openfn job.js', async (t) => {
  const result = await run('openfn job.js', JOB_EXPORT_42);
  t.assert(result === '42');
});

test.serial('run a trivial job from a folder: openfn ~/openfn/jobs/the-question', async (t) => {
  const options = {
    // set up the file system
    jobPath: '~/openfn/jobs/the-question/what-is-the-answer-to-life-the-universe-and-everything.js',
    outputPath: '~/openfn/jobs/the-question/output.json',
    statePath: '~/openfn/jobs/the-question/state.json',
  };

  const result = await run('openfn ~/openfn/jobs/the-question', JOB_EXPORT_42, options);
  t.assert(result === '42');

  const output = await fs.readFile('~/openfn/jobs/the-question/output.json', 'utf8');
  t.assert(output === '42');
});

test.serial('output to file: openfn job.js --output-path=/tmp/my-output.json', async (t) => {
  const options = {
    outputPath: '/tmp/my-output.json'
  };
  const result = await run('openfn job.js --output-path=/tmp/my-output.json', JOB_EXPORT_42, options);
  t.assert(result === '42');

  const output = await fs.readFile('/tmp/my-output.json', 'utf8');
  t.assert(output === '42');
});

test.serial('output to file with alias: openfn job.js -o=/tmp/my-output.json', async (t) => {
  const options = {
    outputPath: '/tmp/my-output.json'
  };
  const result = await run('openfn job.js -o /tmp/my-output.json', JOB_EXPORT_42, options);
  t.assert(result === '42');

  const output = await fs.readFile('/tmp/my-output.json', 'utf8');
  t.assert(output === '42');
});

test.serial('read state from file: openfn job.js --state-path=/tmp/my-state.json', async (t) => {
  const options = {
    statePath: '/tmp/my-state.json',
    state: '33'
  };
  const result = await run('openfn job.js --state-path=/tmp/my-state.json', JOB_TIMES_2, options);
  t.assert(result === '66');
});


test.serial('read state from file with alias: openfn job.js -s /tmp/my-state.json', async (t) => {
  const options = {
    statePath: '/tmp/my-state.json',
    state: '33'
  };
  const result = await run('openfn job.js -s /tmp/my-state.json', JOB_TIMES_2, options);
  t.assert(result === '66');
});

test.serial('read state from stdin: openfn job.js --state-stdin=11', async (t) => {
  const result = await run('openfn job.js --state-stdin=11', JOB_TIMES_2);
  t.assert(result === '22');
});

test.serial('read state from stdin with alias: openfn job.js -S 44', async (t) => {
  const result = await run('openfn job.js -S 44', JOB_TIMES_2);
  t.assert(result === '88');
});

test.serial('override an adaptor: openfn -S 49.5 --adaptor times-two=/modules/times-two', async (t) => {
  const result = await run('openfn -S 49.5 --adaptor times-two=/modules/times-two', JOB_MOCK_ADAPTOR);
  t.assert(result === '99');
});

test.serial('override adaptors: openfn -S 49.5 --adaptors times-two=/modules/times-two', async (t) => {
  const result = await run('openfn -S 49.5 --adaptors times-two=/modules/times-two', JOB_MOCK_ADAPTOR);
  t.assert(result === '99');
});

test.serial('override adaptors: openfn -S 49.5 -a times-two=/modules/times-two', async (t) => {
  const result = await run('openfn -S 49.5 -a times-two=/modules/times-two', JOB_MOCK_ADAPTOR);
  t.assert(result === '99');
});

// TODO - need to work out a way to test agaist stdout
// should return to stdout
// should log stuff to console
// should not log if silent is true

// TODO how would we test skip compilation and no validation? I guess we pass illegal code?
