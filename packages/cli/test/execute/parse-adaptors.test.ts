import test from 'ava';

import { parseAdaptors } from '../../src/execute/execute';

test('parse a simple specifier', (t) => {
  const adaptors = ['a'];
  const result = parseAdaptors({ adaptors });
  t.assert(Object.keys(result).length === 1);
  t.truthy(result.a);
  t.falsy(Object.keys(result.a).length);
});

test('parse multiple specifiers', (t) => {
  const adaptors = ['a', 'b'];
  const result = parseAdaptors({ adaptors });
  t.assert(Object.keys(result).length === 2);
  t.truthy(result.a);
  t.truthy(result.b);
});

test('parse a specifier with a path', (t) => {
  const adaptors = ['a=x'];
  const result = parseAdaptors({ adaptors });
  t.assert(Object.keys(result).length === 1);
  t.deepEqual(result.a, { path: 'x' });
});

test('parse a specifier with a version', (t) => {
  const adaptors = ['a@1'];
  const result = parseAdaptors({ adaptors });
  t.assert(Object.keys(result).length === 1);
  t.deepEqual(result.a, { version: '1' });
});

test('parse a specifier with a path and version', (t) => {
  const adaptors = ['a@1=x'];
  const result = parseAdaptors({ adaptors });
  t.assert(Object.keys(result).length === 1);
  t.deepEqual(result.a, { path: 'x', version: '1' });
});

test('parse @openfn/language-common@1.0.0=~/repo/modules/common', (t) => {
  const adaptors = ['@openfn/language-common@1.0.0=~/repo/modules/common'];
  const result = parseAdaptors({ adaptors });
  t.assert(Object.keys(result).length === 1);
  t.deepEqual(result, {
    '@openfn/language-common': {
      path: '~/repo/modules/common',
      version: '1.0.0',
    },
  });
});
