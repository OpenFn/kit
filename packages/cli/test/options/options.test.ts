// General tests of yargs options parsing
import test from 'ava';
import yargs from 'yargs';
import { build } from '../../src/util/command-builders';

import * as options from '../../src/options';
import type { Opts } from '../../src/options';
import { DEFAULT_REPO_DIR } from '../../src/constants';

// load ALL off the options into a single yargs command
const cmd = yargs().command({
  command: 'test',
  builder: (yargs) => build(Object.values(options), yargs),
  handler: () => {},
});

const parse = (command: string) => cmd.parse(command) as yargs.Arguments<Opts>;

// TODO a good idea to stub in tests for every option (much like ensure-opts)

test('repoDir: use the built-in default if no env var', (t) => {
  const dir = process.env.OPENFN_REPO_DIR;
  delete process.env.OPENFN_REPO_DIR;

  const options = parse('test');

  t.is(options.repoDir, DEFAULT_REPO_DIR);
  process.env.OPENFN_REPO_DIR = dir;
});

test('repoDir: use OPENFN_REPO_DIR env var if set', (t) => {
  const dir = process.env.OPENFN_REPO_DIR;
  process.env.OPENFN_REPO_DIR = 'x/y/z';

  const options = parse('test');

  t.is(options.repoDir, 'x/y/z');
  process.env.OPENFN_REPO_DIR = dir;
});

test('repoDir: accept an argument', (t) => {
  const options = parse('test --repoDir=a/b/c');

  t.is(options.repoDir, 'a/b/c');
});
