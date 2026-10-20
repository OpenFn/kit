// Runs in its own process so that every test starts with no hooks registered
import module from 'node:module';
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
  async 'import-after-registering-three-times'() {
    const counter = new URL('./count-resolves.mjs', import.meta.url);
    if (module.registerHooks) {
      module.registerHooks(await import(counter));
    } else {
      module.register(counter);
    }
    registerEsmHook();
    registerEsmHook();
    registerEsmHook();
    await import(arg);
  },
};

try {
  console.log(JSON.stringify({ result: await actions[action]() }));
} catch (e) {
  console.log(JSON.stringify({ error: e.code ?? e.name }));
}
