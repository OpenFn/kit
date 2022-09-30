import test from 'ava';

import calculateOptions, { defaults }  from '../src/options';

test('should set all values by default', (t) => {
  const o = calculateOptions();

  t.deepEqual(o, defaults);
});

test("defaults to level 'default'", (t) => {
  const o = calculateOptions();

  t.deepEqual(o.level, 'default');
});

test("apply global options if there's no name provided", (t) => {
  const o = calculateOptions({
    global: { level: 'none' },
    test: { level: 'debug' }
  });
  t.assert(o.level === 'none');
});

test("explicitly apply global options", (t) => {
  const o = calculateOptions({
    global: { level: 'none' },
    test: { level: 'debug' }
  }, 'global');
  t.assert(o.level === 'none');
});

test("use namespaced overrides", (t) => {
  const o = calculateOptions({
    global: { level: 'none' },
    test: { level: 'debug' }
  }, 'test');
  t.assert(o.level === 'debug');
});

test("use globals in a namespaced logger", (t) => {
  const o = calculateOptions({
    global: { level: 'none' },
  }, 'test');
  t.assert(o.level === 'none');
});

test("use global properties in a namespaced logger", (t) => {
  const o = calculateOptions({
    global: { level: 'none' },
    test: { wrap: true },
  }, 'test');
  t.assert(o.level === 'none');
});

test("don't mutate default options", (t) => {
  const defaultCopy = { ...defaults };
  
  // Create an options obejct with the same keys as default, but nonsense values
  const opts = {};
  Object.keys(defaultCopy).forEach((key, value) => {
    opts[key] = 99;
  })
  calculateOptions({
    global: opts
  });

  // Ensure the defaults objects remains unchanged
  t.deepEqual(defaultCopy, defaults);
});