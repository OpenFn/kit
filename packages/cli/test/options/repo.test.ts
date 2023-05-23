import test from 'ava';
import yargs from 'yargs';

import { repo } from '../../src/repo/command';

import type { Opts } from '../../src/options';
import { DEFAULT_REPO_DIR } from '../../src/constants';

// Build the repo command and test the options it returns
// Note that this will re-parse the command each time, so env vars will be re-calculated
const parse = (command: string) =>
  yargs().command(repo).parse(command) as yargs.Arguments<Opts>;

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

test('install: always expand adaptors', (t) => {
  const options = parse('repo install');

  t.true(options.expandAdaptors);
});

test('install: install a module', (t) => {
  const options = parse('repo install common');

  t.deepEqual(options.packages, ['common']);
});

test('install: install an adaptor', (t) => {
  const options = parse('repo install -a common');

  t.deepEqual(options.adaptors, ['@openfn/language-common']);
});

test('clean: force', (t) => {
  const options = parse('repo clean -f');

  t.true(options.force);
});
