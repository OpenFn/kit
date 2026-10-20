import test from 'ava';
import { mockFs, restoreFs } from '../helpers/memfs';
import { fileExists } from '../../src/util/file-exists';

test.afterEach(() => {
  restoreFs();
});

test('returns true for an existing file', async (t) => {
  mockFs({ './test.txt': 'content' });
  t.true(await fileExists('./test.txt'));
});

test('returns false for a non-existent path', async (t) => {
  mockFs({});
  t.false(await fileExists('./nonexistent.txt'));
});

test('returns false for a directory', async (t) => {
  mockFs({ './mydir': {} });
  t.false(await fileExists('./mydir'));
});
