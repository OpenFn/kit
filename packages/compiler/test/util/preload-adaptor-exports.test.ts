import test from 'ava';
import path from 'node:path';

import { preloadAdaptorExports } from '../../src/util';

const TEST_ADAPTOR = path.resolve('test/__modules__/adaptor');

test('load exports from a path', async (t) => {
  const result = await preloadAdaptorExports(TEST_ADAPTOR);

  t.assert(result.length === 2);
  t.assert(result.includes('x'));
  t.assert(result.includes('y'));
});

test('load exports from unpkg', async (t) => {
  const result = await preloadAdaptorExports(
    '@openfn/language-common@2.0.0-rc3'
  );

  t.assert(result.length > 0);
  t.assert(result.includes('fn'));
  t.assert(result.includes('combine'));
  t.assert(result.includes('execute'));
  t.assert(result.includes('each'));
});

// TODO test error handling
