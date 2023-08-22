import test from 'ava';
import { isObject } from '../../src/util/';

test('an object', (t) => {
  t.true(isObject({}));

  t.false(isObject(() => {}));
  t.false(isObject(null));
  t.false(isObject(undefined));
  t.false(isObject(NaN));
  t.false(isObject([]));
  t.false(isObject(new Error()));
});
