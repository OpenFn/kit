import test from 'ava';
import path from 'node:path';

import { preloadAdaptorExports } from '../../src/util';

const TEST_ADAPTOR_PATH = path.resolve('test/__modules__/adaptor');

test('load exports from a path', async (t) => {
  const result = await preloadAdaptorExports(TEST_ADAPTOR_PATH);

  t.assert(result.length === 2);
  t.assert(result.includes('x'));
  t.assert(result.includes('y'));
});

test('return an empty array from a bad path', async (t) => {
  const result = await preloadAdaptorExports('jam/jar');

  t.true(Array.isArray(result));
  t.assert(result.length === 0);
});

test('return an empty array from an absolute path', async (t) => {
  const result = await preloadAdaptorExports('jam');

  t.true(Array.isArray(result));
  t.assert(result.length === 0);
});

test('return an empty array from a namespaced absolute path', async (t) => {
  const result = await preloadAdaptorExports('@openfn/jam');

  t.true(Array.isArray(result));
  t.assert(result.length === 0);
});
