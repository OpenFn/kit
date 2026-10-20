import test from 'ava';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const script = path.resolve('test/__esm-hook__/run-job.mjs');

const exec = async (...args: string[]) => {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ['--no-warnings', '--experimental-vm-modules', script, ...args],
    { cwd: path.dirname(script) }
  );
  return JSON.parse(stdout);
};

test('a job can use an adaptor that imports an extensionless CJS subpath', async (t) => {
  const { result } = await exec('job');
  t.is(result, 'set');
});

test('without the hook, the same job fails to import the adaptor', async (t) => {
  const { error } = await exec('job', 'no-hook');
  t.is(error, 'ImportError');
});

test('the hook resolves an extensionless CJS subpath', async (t) => {
  const { result } = await exec('import', 'cjs-subpaths/set');
  t.is(result, 'set');
});

test('the hook leaves a specifier with an extension alone', async (t) => {
  const { result } = await exec('import', 'cjs-subpaths/set.js');
  t.is(result, 'set');
});

test('the hook still fails on a subpath that does not exist', async (t) => {
  const { error } = await exec('import', 'cjs-subpaths/missing');
  t.is(error, 'ERR_MODULE_NOT_FOUND');
});
