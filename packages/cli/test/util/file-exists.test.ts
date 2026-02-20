import test from 'ava';
import mockfs from 'mock-fs';
import { fileExists } from '../../src/util/file-exists';

test.afterEach(() => {
  mockfs.restore();
});

test('returns true for an existing file', async (t) => {
  mockfs({ './test.txt': 'content' });
  t.true(await fileExists('./test.txt'));
});

test('returns false for a non-existent path', async (t) => {
  mockfs({});
  t.false(await fileExists('./nonexistent.txt'));
});

test('returns false for a directory', async (t) => {
  mockfs({ './mydir': {} });
  t.false(await fileExists('./mydir'));
});
