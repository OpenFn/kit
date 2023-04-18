import test from 'ava';
import cache from '../../src/metadata/cache';

test('sort keys', (t) => {
  const sorted = cache.sortKeys({
    z: 'x',
    a: 'x',
    A: 'x',
  });

  t.is(
    JSON.stringify(sorted),
    JSON.stringify({
      A: 'x',
      a: 'x',
      z: 'x',
    })
  );
});

test('sort keys deeply', (t) => {
  const sorted = cache.sortKeys({
    y: {
      z: 'x',
      a: 'x',
      A: 'x',
    },
    x: {
      z: 'x',
      a: 'x',
      A: 'x',
    },
  });

  t.is(
    JSON.stringify(sorted),
    JSON.stringify({
      x: {
        A: 'x',
        a: 'x',
        z: 'x',
      },
      y: {
        A: 'x',
        a: 'x',
        z: 'x',
      },
    })
  );
});

test("Don't sort arrays", (t) => {
  const sorted = cache.sortKeys({
    a: [9, 2, 3],
  });
  t.is(
    JSON.stringify(sorted),
    JSON.stringify({
      a: [9, 2, 3],
    })
  );
});

test('handle numeric values', (t) => {
  const sorted = cache.sortKeys({
    a: 1,
    b: -1,
    c: Infinity,
    d: NaN,
    e: 0,
    f: 0.5,
  });
  t.is(
    JSON.stringify(sorted),
    JSON.stringify({
      a: 1,
      b: -1,
      c: Infinity,
      d: NaN,
      e: 0,
      f: 0.5,
    })
  );
});

test('handle falsy values', (t) => {
  const sorted = cache.sortKeys({
    a: undefined,
    b: null,
    c: false,
    d: 0,
  });
  t.is(
    JSON.stringify(sorted),
    JSON.stringify({
      a: undefined,
      b: null,
      c: false,
      d: 0,
    })
  );
});
