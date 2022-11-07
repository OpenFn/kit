import test from 'ava';
import { getNameAndVersion } from '../../src/modules/repo';

test('parse x@1', async (t) => {
  const { name, version } = getNameAndVersion('x@1');
  t.is(name, 'x');
  t.is(version, '1');
});

test('parse x@1.0.0', async (t) => {
  const { name, version } = getNameAndVersion('x@1.0.0');
  t.is(name, 'x');
  t.is(version, '1.0.0');
});

test('parse axios@1.0.0', async (t) => {
  const { name, version } = getNameAndVersion('axios@1.0.0');
  t.is(name, 'axios');
  t.is(version, '1.0.0');
});

test('parse @x/y@1.0.0', async (t) => {
  const { name, version } = getNameAndVersion('@x/y@1.0.0');
  t.is(name, '@x/y');
  t.is(version, '1.0.0');
});

test('parse @openfn/language-common@1.0.0', async (t) => {
  const { name, version } = getNameAndVersion('@openfn/language-common@1.0.0');
  t.is(name, '@openfn/language-common');
  t.is(version, '1.0.0');
});

test('parse @openfn/language-common', async (t) => {
  const { name, version } = getNameAndVersion('@openfn/language-common');
  t.is(name, '@openfn/language-common');
  t.falsy(version);
});
