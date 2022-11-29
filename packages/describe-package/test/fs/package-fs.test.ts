import test from 'ava';

import {
  fetchDTSListing,
  fetchFile,
  fetchFileListing,
} from '../../src/fs/package-fs';

test('fetchDTS lists .d.ts files for a given package', async (t) => {
  t.timeout(20000);

  const results: string[] = [];
  for await (const f of fetchDTSListing('@typescript/vfs@1.4.0')) {
    results.push(f);
  }

  t.deepEqual(results, ['/dist/index.d.ts']);
});

test('fetchFile retrieves a file for a given package', async (t) => {
  const result = await fetchFile('@typescript/vfs/dist/index.d.ts');

  t.truthy(result);
});

test('fetchFileListing returns a flat list of files', async (t) => {
  const result = await fetchFileListing('@openfn/language-common@1.7.5');
  t.true(result.includes('/ast.json'));
  t.true(result.includes('/package.json'));
  t.true(result.includes('/dist/index.js'));
  t.true(result.includes('/types/Adaptor.d.ts'));
});
