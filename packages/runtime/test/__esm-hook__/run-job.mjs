// Runs in its own process so that every test starts with no hooks registered
import path from 'node:path';
import run, { registerEsmHook } from '../../dist/index.js';

const [action, arg] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);

const actions = {
  async job() {
    const state = await run(
      `import { value } from 'adaptor-with-subpath';
      export default [() => ({ value })];`,
      {},
      {
        disableEsmHook: arg === 'no-hook',
        linker: {
          modules: {
            'adaptor-with-subpath': {
              path: path.join(here, 'node_modules/adaptor-with-subpath'),
            },
          },
        },
      }
    );
    return state.value;
  },
  async import() {
    registerEsmHook();
    const m = await import(arg);
    return m.default;
  },
};

try {
  console.log(JSON.stringify({ result: await actions[action]() }));
} catch (e) {
  console.log(JSON.stringify({ error: e.code ?? e.name }));
}
