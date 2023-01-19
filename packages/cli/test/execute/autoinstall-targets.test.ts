import test from 'ava';

import { getAutoinstallTargets } from '../../src/execute/handler';

test('return empty if an empty array is passed', (t) => {
  const result = getAutoinstallTargets({
    adaptors: [],
  });
  t.truthy(result);
  t.is(result.length, 0);
});

test('return 2 valid targets', (t) => {
  const result = getAutoinstallTargets({
    adaptors: ['a', 'b'],
  });
  t.truthy(result);
  t.is(result.length, 2);
  t.deepEqual(result, ['a', 'b']);
});

test('return empty if a path is passed', (t) => {
  const result = getAutoinstallTargets({
    adaptors: ['a=a/b/c'],
  });
  t.truthy(result);
  t.is(result.length, 0);
});

test('return 1 valid target', (t) => {
  const result = getAutoinstallTargets({
    adaptors: ['a=/some/path', 'b@1.2.3'],
  });
  t.truthy(result);
  t.is(result.length, 1);
  t.deepEqual(result, ['b@1.2.3']);
});

test('return language common', (t) => {
  const result = getAutoinstallTargets({
    adaptors: ['@openfn/language-common'],
  });
  t.truthy(result);
  t.is(result.length, 1);
  t.deepEqual(result, ['@openfn/language-common']);
});

test('return language common with specifier', (t) => {
  const result = getAutoinstallTargets({
    adaptors: ['@openfn/language-common@1.0.0'],
  });
  t.truthy(result);
  t.is(result.length, 1);
  t.deepEqual(result, ['@openfn/language-common@1.0.0']);
});

test('reject language common with path', (t) => {
  const result = getAutoinstallTargets({
    adaptors: ['@openfn/language-common=/a/b/c'],
  });
  t.truthy(result);
  t.is(result.length, 0);
});

test('reject language common with specifier and path', (t) => {
  const result = getAutoinstallTargets({
    adaptors: ['@openfn/language-common@1.0.0=/tmp/repo/common'],
  });
  t.truthy(result);
  t.is(result.length, 0);
});
