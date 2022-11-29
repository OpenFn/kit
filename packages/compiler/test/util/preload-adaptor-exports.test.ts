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

// This test is currently failing because a lot of the functions in the 2.0 common
// aren't marked as public
// But I think this test is redundant now that we have the repo and autoinstall - I don't
// think we should be fetching from unpkg at all.
// Raised an issue #103 to think about this with a clearer head
test.skip('load exports from unpkg', async (t) => {
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
