import vm from 'node:vm';
import test from "ava";
import loadModule from '../../src/modules/module-loader'

test('load a simple module', async (t) => {
  const src = "export default 20;"

  const m = await loadModule(src);

  t.assert(m.default === 20);
});

test('load a module with a function', async (t) => {
  const src = "export default () => 20;"

  const m = await loadModule(src);
  const result = m.default();

  t.assert(result === 20);
});

test('load a module with a context', async (t) => {
  const src = "export default x;"

  const context = vm.createContext({ x: 20 });
  const m = await loadModule(src, { context });

  t.assert(m.default === 20);
});

test('load a module with an import', async (t) => {
  const src = "import x from 'something'; export default x;"

  // All imports will call a linker function to resolve the actual import
  // This simple linker just exercises the linker code
  const linker = async (_specifier: string, context: vm.Context) => {
    // @ts-ignore no defs for this experimental API
    const m = new vm.SourceTextModule('export default 20;', { context });
    await m.link(() => {});
    await m.evaluate();
    return m;
  };
  const m = await loadModule(src, { linker });

  t.assert(m.default === 20);
})

test('load a module with aribtrary exports', async (t) => {
  const src = "export const x = 10; export const y = 20;";

  const m = await loadModule(src);

  t.assert(m.x === 10);
  t.assert(m.y === 20);
});

// throw if an unrecognise import is provided
