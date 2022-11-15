import test from 'ava';
import vm from 'node:vm';
import path from 'node:path';

import linker from '../../src/modules/linker';

let context = vm.createContext();

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
test('load a simple test module', async (t) => {
  const m = await linker(
    path.resolve('test/__modules__/number-export.js'),
    context
  );

  t.assert(m.namespace.default === 20);
});

test('load a fancy test module', async (t) => {
  const m = await linker(
    path.resolve('test/__modules__/fn-export.js'),
    context
  );

  t.assert(m.namespace.fn() === 20);
});

test('load a fancy test module with dependencies', async (t) => {
  const m = await linker(
    path.resolve('test/__modules__/fn-export-with-deps.js'),
    context
  );

  t.assert(m.namespace.default() === 40);
});

test('load @openfn/language-common from node modules', async (t) => {
  const m = await linker('@openfn/language-common', context);

  const exports = Object.keys(m.namespace);
  t.assert(exports.includes('fn'));
  t.assert(exports.includes('execute'));
  t.assert(exports.includes('field'));

  // Exercise the API a little
  const { fn, execute, field } = m.namespace;
  t.deepEqual(field('a', 1), ['a', 1]);

  const queue = [
    fn((x: number) => x + 1),
    fn((x: number) => x + 1),
    fn((x: number) => x + 1),
  ];
  const result = await execute(...queue)(1);
  t.assert(result === 4);
});

test('throw if a non-whitelisted value is passed', async (t) => {
  await t.throwsAsync(() =>
    linker('i-heart-hacking', context, { whitelist: [/^@openfn\//] })
  );
});

test('does not throw if an exact whitelisted value is passed', async (t) => {
  await t.notThrowsAsync(() =>
    linker('@openfn/language-common', context, {
      whitelist: [/^@openfn\/language-common$/],
    })
  );
});

test('does not throw if a partial whitelisted value is passed', async (t) => {
  await t.notThrowsAsync(() =>
    linker('@openfn/language-common', context, { whitelist: [/^@openfn\//] })
  );
});

test("Fails to load a module it can't find", async (t) => {
  await t.throwsAsync(() =>
    linker('ultimate-answer', context, { whitelist: [/^@openfn\//] })
  );
});

test('loads a module from a specific path', async (t) => {
  const options = {
    modules: {
      'ultimate-answer': {
        path: path.resolve('test/__modules__/ultimate-answer'),
      },
    },
  };
  const m = await linker('ultimate-answer', context, options);
  t.assert(m.namespace.default === 42);
});

test('loads a specific module version from the repo', async (t) => {
  const options = {
    repo: path.resolve('test/__repo'),
  };
  const m = await linker('ultimate-answer@1.0.0', context, options);
  t.assert(m.namespace.default === 42);
});

test('loads the latest module version from the repo', async (t) => {
  const options = {
    repo: path.resolve('test/__repo'),
  };
  const m = await linker('ultimate-answer', context, options);
  t.assert(m.namespace.default === 43);
});
