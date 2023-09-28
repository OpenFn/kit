import test from 'ava';

import stringify from '../../src/util/stringify';

test('should stringify an object', (t) => {
  const obj = { a: 1 };
  const str = stringify(obj);

  t.is(str, '{"a":1}');
});

test('should stringify a nested object', (t) => {
  const obj = { a: { b: 1 } };
  const str = stringify(obj);

  t.is(str, '{"a":{"b":1}}');
});

test('should stringify an ArrayBuffer', (t) => {
  const buff = new Uint8Array([42]);
  const str = stringify(buff);

  t.is(str, '[42]');
});
