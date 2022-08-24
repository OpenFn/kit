/*
 * Here's where it gets a bit more difficult
 * We need the linker to be able to load nested dependencies of modules
 * 
 * I am really worried about the dynamic import in langauge-common
 */
import test from 'ava';
import vm from 'node:vm';
import path from 'node:path';

import linker from '../src/linker';

let context = vm.createContext();

test.beforeEach(() => {
  context = vm.createContext();
});

test("basic import stuff", async (t) => {
  const m1 = await import('./test-module-simple.js');
  t.assert(m1.default === 20);

  const m2 = await import('./test-module-fancy.js');
  t.assert(m2.fn() === 20);

  const m3 = await import('./test-module-fancy-with-deps.js');
  t.assert(m3.default() ===  40);

  const common = await import('@openfn/language-common');
  t.assert(common.hasOwnProperty('fn'))
  t.assert(common.hasOwnProperty('each'))
  t.assert(common.hasOwnProperty('combine'))
});

test("loads a simple test module", async (t) => {
  // exports 20 as a default
  const m = await linker(path.resolve("test/test-module-simple.js"), context);
  
  // @ts-ignore test the namespace
  t.assert(m.namespace.default === 20);
});

test("loads a fancy test module", async (t) => {
  // Exports a named function fn, which returns 20
  const m = await linker(path.resolve("test/test-module-fancy.js"), context);
  
  // @ts-ignore test the namespace
  t.assert(m.namespace.fn() === 20);
});

test("loads a fancy test module with dependencies", async (t) => {
  // Exports a default function which returns double fancy-module.fn
  const m = await linker(path.resolve("test/test-module-fancy-with-deps.js"), context);
  
  // @ts-ignore test the namespace
  t.assert(m.namespace.default() === 40);
});

// loads openfn common
test("loads @openfn/langauge-common", async (t) => {
  const m = await linker("@openfn/language-common", context);
  
  // @ts-ignore test the namespace
  const exports = Object.keys(m.namespace);
  t.assert(exports.includes("fn"))
  t.assert(exports.includes("execute"))
  t.assert(exports.includes("field"))
  
  // Exercise the API a little
  const { fn, execute, field } = m.namespace;
  t.deepEqual(field('a', 1), ['a', 1]);

  const queue = [
    fn((x: number) => x + 1),
    fn((x: number) => x + 1),
    fn((x: number) => x + 1),
  ];
  const result = await execute(...queue)(1)
  t.assert(result === 4);

});

test("will throw if a non-whitelisted value is passed", async (t) => {
  // Exports a named function fn, which returns 20
  await t.throwsAsync(
    () => linker('i-heart-hacking', context, [/^@openfn\//])
  );
});

test("will not throw if a whitelisted value is passed", async (t) => {
  // Exports a named function fn, which returns 20
  await t.notThrowsAsync(
    () => linker('@openfn/language-common', context, [/^@openfn\//])
  );
});