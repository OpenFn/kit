import test from 'ava';
import getNameAndVersion from '../../src/repo/get-name-and-version';

test('parse x@1', async (t) => {
  const { name, version } = await getNameAndVersion('x@1');
  t.is(name, 'x');

  // TODO this should in fact look up minor and patch versions
  // (but I'm happy to ignore that for now)
  t.is(version, '1');
});

test('parse x@1.0.0', async (t) => {
  const { name, version } = await getNameAndVersion('x@1.0.0');
  t.is(name, 'x');
  t.is(version, '1.0.0');
});

test('parse axios@1.0.0', async (t) => {
  const { name, version } = await getNameAndVersion('axios@1.0.0');
  t.is(name, 'axios');
  t.is(version, '1.0.0');
});

test('parse @x/y@1.0.0', async (t) => {
  const { name, version } = await getNameAndVersion('@x/y@1.0.0');
  t.is(name, '@x/y');
  t.is(version, '1.0.0');
});

test('parse @openfn/language-common@1.0.0', async (t) => {
  const { name, version } = await getNameAndVersion(
    '@openfn/language-common@1.0.0'
  );
  t.is(name, '@openfn/language-common');
  t.is(version, '1.0.0');
});

test('parse @openfn/language-common', async (t) => {
  const { name, version } = await getNameAndVersion('@openfn/language-common');
  t.is(name, '@openfn/language-common');

  // This does a live lookup and we don't care the actual version number,
  // just that we have some kind of version string
  t.assert(typeof version === 'string');
  t.assert(/^(\d+)\.(\d+)\.(\d+)$/.test(version));
});
