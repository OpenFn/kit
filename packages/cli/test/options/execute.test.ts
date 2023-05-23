import test from 'ava';
import yargs from 'yargs';

import execute from '../../src/execute/command';

import type { Opts } from '../../src/options';
import { DEFAULT_REPO_DIR } from '../../src/constants';

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

test('repoDir: use the built-in default if no env var', (t) => {
  const dir = process.env.OPENFN_REPO_DIR;
  delete process.env.OPENFN_REPO_DIR;

  const options = parse('repo');

  t.is(options.repoDir, DEFAULT_REPO_DIR);
  process.env.OPENFN_REPO_DIR = dir;
});

test('repoDir: use OPENFN_REPO_DIR env var if set', (t) => {
  const dir = process.env.OPENFN_REPO_DIR;
  process.env.OPENFN_REPO_DIR = 'x/y/z';

  const options = parse('repo');

  t.is(options.repoDir, 'x/y/z');
  process.env.OPENFN_REPO_DIR = dir;
});

test('repoDir: accept an argument', (t) => {
  const options = parse('repo --repoDir=a/b/c');

  t.is(options.repoDir, 'a/b/c');
});
