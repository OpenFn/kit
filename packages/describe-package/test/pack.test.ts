import test from 'ava';

import { Pack } from '../src/pack';

test('fetch resolves the specifier after getting the package.json', async (t) => {
  t.timeout(20000);

  const pack = await Pack.fetch('@openfn/language-common@1.7.5');
  t.is(pack.path, '@openfn/language-common@1.7.5');
  t.regex(pack.specifier, /^@openfn\/language-common@\d\.\d\.\d/);
});

test('fetch loads the file listing', async (t) => {
  t.timeout(20000);

  const pack = await Pack.fetch('@openfn/language-common@2.0.0-rc1');
  t.is(pack.path, '@openfn/language-common@2.0.0-rc1');
  t.true(pack.fileListing.includes('/LICENSE'));
  t.true(pack.fileListing.includes('/dist/index.cjs'));
  t.true(pack.fileListing.includes('/dist/index.js'));
  t.true(pack.fileListing.includes('/dist/language-common.d.ts'));
  t.true(pack.fileListing.includes('/package.json'));
  t.true(pack.fileListing.includes('/LICENSE.LESSER'));
  t.true(pack.fileListing.includes('/README.md'));

  t.is(pack.fsMap.size, 0);
  await pack.getFiles();
  t.is(pack.fsMap.size, 7);

  t.is(
    pack.types,
    '/node_modules/@openfn/language-common/dist/language-common.d.ts'
  );
  t.truthy(pack.fsMap.get(pack.types!));
});

test("fetch throws an error when a package can't be found", async (t) => {
  await t.throwsAsync(async () => Pack.fetch('@openfn/foobar'), {
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
