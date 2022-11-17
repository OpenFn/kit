import test from 'ava';

import { Pack } from '../src/pack';

test('fromUnpkg resolves the specifier after getting the package.json', async (t) => {
  t.timeout(20000);

  const pack = await Pack.fromUnpkg('@openfn/language-common');
  t.is(pack.path, '@openfn/language-common');
  t.regex(pack.specifier, /^@openfn\/language-common@\d\.\d\.\d/);
});

test('fromUnpkg loads the file listing', async (t) => {
  t.timeout(20000);

  const pack = await Pack.fromUnpkg('@openfn/language-common@2.0.0-rc1');
  t.is(pack.path, '@openfn/language-common@2.0.0-rc1');
  t.deepEqual(pack.fileListing, [
    '/LICENSE',
    '/dist/index.cjs',
    '/dist/index.js',
    '/dist/language-common.d.ts',
    '/package.json',
    '/LICENSE.LESSER',
    '/README.md',
  ]);

  t.is(pack.fsMap.size, 0);
  await pack.getFiles();
  t.is(pack.fsMap.size, 7);

  t.is(
    pack.types,
    '/node_modules/@openfn/language-common/dist/language-common.d.ts'
  );
  t.truthy(pack.fsMap.get(pack.types!));
});

test("Unpkg throws an error when a package can't be found", async (t) => {
  await t.throwsAsync(async () => Pack.fromUnpkg('@openfn/foobar'), {
    message: 'Got 404 from Unpkg for: @openfn/foobar/package.json',
  });
});

test("getters for 'types' property", (t) => {
  let pack = new Pack({
    path: 'foopackage',
    packageJson: {
      name: 'foopackage',
      version: '1.2.3',
      types: 'dist/index.d.ts',
    },
  });

  t.is(pack.types, '/node_modules/foopackage/dist/index.d.ts');

  pack = new Pack({
    path: 'foopackage',
    packageJson: { name: 'foopackage', version: '1.2.3' },
  });

  t.is(pack.types, null);
});
