import test from 'ava';
import path from 'node:path';
import {
  getAliasedName,
  getLatestInstalledVersion,
  getNameAndVersion,
} from '../../src/repo/util';

test('getAliasedName: with package name only', (t) => {
  const name = getAliasedName('x');
  t.is(name, 'x');
});

test('getAliasedName: with versioned specifier', (t) => {
  const name = getAliasedName('x@1');
  t.is(name, 'x_1');
});

test('getAliasedName: with name and vesion', (t) => {
  const name = getAliasedName('x', '1');
  t.is(name, 'x_1');
});

test('getLatestInstalledVersion: return null if no version', async (t) => {
  const pkg = {
    dependencies: {},
  };
  const result = await getLatestInstalledVersion('openfn', '', pkg);
  t.assert(result === null);
});

test('getLatestInstalledVersion: return the matching version', async (t) => {
  const pkg = {
    dependencies: {
      'openfn-fake_4.0.0': '',
      'openfn_3.0.0': '',
      'not_openfn_3.0.0': '',
    },
  };
  const result = await getLatestInstalledVersion('openfn', '', pkg);
  t.assert(result === 'openfn_3.0.0');
});

test('getLatestInstalledVersion: return the higher version of 2', async (t) => {
  const pkg = {
    dependencies: {
      'openfn_2.0.0': '',
      'openfn_3.0.0': '',
    },
  };
  const result = await getLatestInstalledVersion('openfn', '', pkg);
  t.assert(result === 'openfn_3.0.0');
});

test('getLatestInstalledVersion: return the higher if order is changed', async (t) => {
  const pkg = {
    dependencies: {
      'openfn_3.0.0': '',
      'openfn_2.0.0': '',
    },
  };
  const result = await getLatestInstalledVersion('openfn', '', pkg);
  t.assert(result === 'openfn_3.0.0');
});

test('getLatestInstalledVersion: should read package json from disk', async (t) => {
  const result = await getLatestInstalledVersion(
    'ultimate-answer',
    path.resolve('test/__repo')
  );
  t.assert(result === 'ultimate-answer_2.0.0');
});

test('getNameandVersion: x@1', async (t) => {
  const { name, version } = getNameAndVersion('x@1');
  t.is(name, 'x');
  t.is(version, '1');
});

test('getNameandVersion: x@1.0.0', async (t) => {
  const { name, version } = getNameAndVersion('x@1.0.0');
  t.is(name, 'x');
  t.is(version, '1.0.0');
});

test('getNameandVersion: axios@1.0.0', async (t) => {
  const { name, version } = getNameAndVersion('axios@1.0.0');
  t.is(name, 'axios');
  t.is(version, '1.0.0');
});

test('getNameandVersion: @x/y@1.0.0', async (t) => {
  const { name, version } = getNameAndVersion('@x/y@1.0.0');
  t.is(name, '@x/y');
  t.is(version, '1.0.0');
});

test('getNameandVersion: @openfn/language-common@1.0.0', async (t) => {
  const { name, version } = getNameAndVersion('@openfn/language-common@1.0.0');
  t.is(name, '@openfn/language-common');
  t.is(version, '1.0.0');
});

test('getNameandVersion: @openfn/language-common', async (t) => {
  const { name, version } = getNameAndVersion('@openfn/language-common');
  t.is(name, '@openfn/language-common');
  t.falsy(version);
});
