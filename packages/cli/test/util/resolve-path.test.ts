import test from 'ava';
import nodepath from 'node:path';
import { homedir } from 'node:os';

import resolvePath from '../../src/util/resolve-path';

const workingDir = nodepath.resolve();

test('should resolve a relative path', (t) => {
  const path = resolvePath('a/b/c');
  t.is(path, workingDir + '/a/b/c');
});

test('should resolve an absolute path', (t) => {
  const path = resolvePath('/a/b/c');
  t.is(path, '/a/b/c');
});

test('should resolve a home path', (t) => {
  const path = resolvePath('~/a/b/c');
  t.is(path, homedir + '/a/b/c');
});

test('should resolve path relative to a relative root', (t) => {
  const path = resolvePath('a/b/c', 'tmp');
  t.is(path, workingDir + '/tmp/a/b/c');
});

test('should resolve path relative to an absolute root', (t) => {
  const path = resolvePath('a/b/c', '/tmp');
  t.is(path, '/tmp/a/b/c');
});
