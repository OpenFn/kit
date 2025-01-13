import test from 'ava';
import vm from 'node:vm';
import path from 'node:path';

import linker from '../../src/modules/linker';

let context = vm.createContext();

const repo = path.resolve('test/__repo__');
const options = {
  repo,
};

test.beforeEach(() => {
  context = vm.createContext();
});

/**
 * Run some basic tests that we can define and import mini-modules within the test harness
 */
test("assert we can dynamically import module 'number-export'", async (t) => {
  const m1 = await import('../__modules__/number-export.js');
  t.assert(m1.default === 20);
});

test('assert we can dynamically import fn-export', async (t) => {
  const m2 = await import('../__modules__/fn-export.js');
  t.assert(m2.fn() === 20);
});

test('assert we can dynamically import fn-export-with-deps', async (t) => {
  const m3 = await import('../__modules__/fn-export-with-deps.js');
  t.assert(m3.default() === 40);
});

test('assert we can dynamically import ultimate-answer', async (t) => {
  const m3 = await import('../__modules__/ultimate-answer');
  t.assert(m3.default === 42);
});

test('assert we can dynamically import @openfn/language-common from node_modules', async (t) => {
  const common = await import('@openfn/language-common');
  t.truthy(common.fn);
  t.truthy(common.each);
  t.truthy(common.combine);
});

/**
 * Use the linker to load various modules
 */
test('load a simple test module from a path', async (t) => {
  const m = await linker(
    path.resolve('test/__modules__/number-export.js'),
    context,
    options
  );

  t.assert(m.namespace.default === 20);
});

test('load a fancy test module from a path', async (t) => {
  const m = await linker(
    path.resolve('test/__modules__/fn-export.js'),
    context,
    options
  );

  t.assert(m.namespace.fn() === 20);
});

test('load a fancy test module with dependencies from a path', async (t) => {
  const m = await linker(
    path.resolve('test/__modules__/fn-export-with-deps.js'),
    context,
    options
  );

  t.assert(m.namespace.default() === 40);
});

test('loads a specific module version from the repo', async (t) => {
  const m = await linker('ultimate-answer@1.0.0', context, options);
  t.assert(m.namespace.default === 42);
});

test('loads the latest available module from the repo', async (t) => {
  const m = await linker('ultimate-answer', context, options);
  t.assert(m.namespace.default === 43);
});

test('loads a cjs module from the repo', async (t) => {
  const m = await linker('cjs', context, options);
  t.assert(m.namespace.default === 42);
});

test('loads a module from a path', async (t) => {
  const m = await linker('ultimate-answer', context, {
    modules: {
      ['ultimate-answer']: {
        path: path.resolve('test/__modules__/@openfn/language-test'),
        version: '0.0.1',
      },
    },
  });
  t.assert(m.namespace.default === 'test');
});

test('imports with a cacheKey', async (t) => {
  const opts = {
    ...options,
    cacheKey: 'abc',
  };
  const m = await linker('ultimate-answer', context, opts);
  t.assert(m.namespace.default === 43);
});

test('modules will be cached by default', async (t) => {
  const modulePath = path.resolve('test/__modules__/number-export.js');
  const m1 = await linker(modulePath, context, options);

  t.is(m1.namespace.getNumber(), 20);

  const result = m1.namespace.increment();

  t.is(result, 21);

  const m2 = await linker(modulePath, context, options);

  t.is(m2.namespace.getNumber(), 21);
});

test('cachekey busts the module cache', async (t) => {
  const modulePath = path.resolve('test/__modules__/number-export.js');

  const opts1 = {
    ...options,
    cacheKey: 'a',
  };
  const m1 = await linker(modulePath, context, opts1);

  t.is(m1.namespace.getNumber(), 20);

  const result = m1.namespace.increment();

  t.is(result, 21);

  const opts2 = {
    ...options,
    cacheKey: 'b',
  };
  const m2 = await linker(modulePath, context, opts2);

  t.is(m2.namespace.getNumber(), 20);
});

test('throw if a non-whitelisted value is passed', async (t) => {
  await t.throwsAsync(() =>
    linker('i-heart-hacking', context, { repo, whitelist: [/^@openfn\//] })
  );
});

test('does not throw if an exact whitelisted value is passed', async (t) => {
  await t.notThrowsAsync(() =>
    linker('ultimate-answer', context, {
      repo,
      whitelist: [/^ultimate-answer$/],
    })
  );
});

test('does not throw if a partial whitelisted value is passed', async (t) => {
  await t.notThrowsAsync(() =>
    linker('ultimate-answer', context, { repo, whitelist: [/^ultimate/] })
  );
});

test("Throws if it can't find a module", async (t) => {
  await t.throwsAsync(() => linker('err', context, options), {
    message: 'Failed to import module "err"',
    name: 'ImportError',
  });
});
