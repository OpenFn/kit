import test from 'ava';
import { getAliasedName } from '../../src/modules/repo';

test('get alias with package name only', (t) => {
  const name = getAliasedName('x');
  t.is(name, 'x');
});

test('get alias with versioned specifier', (t) => {
  const name = getAliasedName('x@1');
  t.is(name, 'x_1');
});

test('get alias with name and vesion', (t) => {
  const name = getAliasedName('x', '1');
  t.is(name, 'x_1');
});

test('get alias with namespace and version', (t) => {
  const name = getAliasedName('@x/y@1.0.0');
  t.is(name, '@x/y_1.0.0');
});
