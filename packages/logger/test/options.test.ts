import test from 'ava';

import calculateOptions, { defaults } from '../src/options';

test('should set all values by default', (t) => {
  const o = calculateOptions();

  t.deepEqual(o, defaults);
});

test("defaults to level 'default'", (t) => {
  const o = calculateOptions();

  t.deepEqual(o.level, 'default');
});

test('level can be overriden', (t) => {
  const o = calculateOptions({
    level: 'debug',
  });
  t.assert(o.level === 'debug');
});

test('all defaults can be overridden', (t) => {
  const newOpts = Object.keys(defaults).reduce((obj, k) => {
    // @ts-ignore
    obj[k] = 22;
    return obj;
  }, {});
  const o = calculateOptions(newOpts);
  t.deepEqual(newOpts, o);
});

test("don't mutate default options", (t) => {
  const defaultCopy = { ...defaults };

  // Create an options obejct with the same keys as default, but nonsense values
  const opts = {};
  Object.keys(defaultCopy).forEach((key) => {
    // @ts-ignore
    opts[key] = 99;
  });
  calculateOptions(opts);

  // Ensure the defaults objects remains unchanged
  t.deepEqual(defaultCopy, defaults);
});
