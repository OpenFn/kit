import test from 'ava';
import fs from 'node:fs/promises';
import path from 'node:path';

import compile from '../src/compile';

test('twitter.js', async (t) => {
  const source = await fs.readFile(path.resolve('test/jobs/twitter.js'), 'utf8');
  // The expected source has been taken from a previous compilation
  // This is expected to change in future
  const expected = await fs.readFile(path.resolve('test/jobs/twitter.compiled.js'), 'utf8');
  const result = compile(source);
  t.deepEqual(result, expected);
});