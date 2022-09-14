import test from 'ava';

// Note: mock-fs seems to break recast (?!)
import mock from 'mock-fs';
import fs from 'node:fs/promises';

import { cmd } from '../src/cli';
import execute, { Opts } from '../src/execute';

test.afterEach(() => {
  mock.restore();
})

const JOB_PATH = "job.js";
const STATE_PATH = "state.json";
const OUTPUT_PATH = "output.json";

async function run(command: string, job: string, state: string='{}') {
  // mock the input
  mock({
    [JOB_PATH]: job,
    [STATE_PATH]: state,
    [OUTPUT_PATH]: '{}',
  })

  const opts = cmd.parse(command) as Opts;
  
  // TODO skip compilation for now because mock-fs seems to break recast
  opts.noCompile = true;
  opts.silent = true;
  await execute(JOB_PATH, opts);
  
  // read the mock output
  return fs.readFile(OUTPUT_PATH, 'utf8');
}

test('simple job run', async (t) => {
  // This trivial job should just write 42 as state
  const job = 'export default [() => 42];'
  
  // uh but the mock won't extend into the child process, surely?
  const result = await run('openfn job.js', job);
  t.assert(result === `${42}`);
})