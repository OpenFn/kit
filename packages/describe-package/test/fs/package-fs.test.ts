import test from 'ava';

import {
  fetchDTSListing,
  fetchFile,
  flattenFiles,
} from '../../src/fs/package-fs';

test('flattenFiles', async (t) => {
  const listing = {
    path: 'a',
    type: 'directory',
    files: [
      {
        path: 'node_modules',
        type: 'directory',
        files: [{ path: '/node_modules/x.js', type: 'file' }],
      },
      {
        path: 'lib',
        type: 'directory',
        files: [{ path: '/lib/y.js', type: 'file' }],
      },
      { path: '/a.js', type: 'file' },
    ],
  };
  const results: string[] = [];
  for await (const f of flattenFiles(listing)) {
    results.push(f);
  }
  t.is(results.length, 3);
  t.assert(results.includes('/node_modules/x.js'));
  t.assert(results.includes('/lib/y.js'));
  t.assert(results.includes('/a.js'));
});

test('flattenFiles ignores node_modules', async (t) => {
  const listing = {
    path: 'a',
    type: 'directory',
    files: [
      {
        path: '/node_modules',
        type: 'directory',
        files: [{ path: '/node_modules/x.js', type: 'file' }],
      },
      {
        path: 'lib',
        type: 'directory',
        files: [{ path: '/lib/y.js', type: 'file' }],
      },
      { path: '/a.js', type: 'file' },
    ],
  };
  const results: string[] = [];
  for await (const f of flattenFiles(listing, true)) {
    results.push(f);
  }
  t.is(results.length, 2);
  t.assert(results.includes('/lib/y.js'));
  t.assert(results.includes('/a.js'));
});

test('fetchDTS lists .d.ts files for a given package', async (t) => {
  t.timeout(20000);

  const results: string[] = [];
  for await (const f of fetchDTSListing('@typescript/vfs')) {
    results.push(f);
  }

  t.deepEqual(results, ['/dist/index.d.ts']);
});

test('fetchFile retrieves a file for a given package', async (t) => {
  const result = await fetchFile('@typescript/vfs/dist/index.d.ts');

  t.truthy(result);
});
