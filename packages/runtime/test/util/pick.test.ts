import test from 'ava';
import pick from '../../src/util/pick';

test('should pick a key', (t) => {
  const obj = {
    a: 1,
    b: 2,
    c: 3,
  };
  const result = pick(obj, 'b');
  t.deepEqual(result, { b: 2 });
});

test('should pick multiple keys', (t) => {
  const obj = {
    a: 1,
    b: 2,
    c: 3,
    d: 4,
  };
  const result = pick(obj, 'b', 'c');
  t.deepEqual(result, { b: 2, c: 3 });
});

test('should pick nothing if no keys passed', (t) => {
  const obj = {
    a: 1,
    b: 2,
    c: 3,
    d: 4,
  };
  const result = pick(obj);
  t.deepEqual(result, {});
});

test('should not mutate', (t) => {
  const obj = {
    a: 1,
    b: 2,
    c: 3,
    d: 4,
  };
  const result = pick(obj, 'd');
  t.deepEqual(result, { d: 4 });
  t.deepEqual(obj, {
    a: 1,
    b: 2,
    c: 3,
    d: 4,
  });
});

test("shouldn't pick empty keys", (t) => {
  const obj = {
    a: 1,
    b: 2,
    c: 3,
    d: 4,
  };
  // @ts-ignore
  const result = pick(obj, 'a', 'z');
  t.deepEqual(result, { a: 1 });
});
