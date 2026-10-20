import module from 'node:module';
import path from 'node:path';
import url from 'node:url';
import { resolveSync } from './esm-resolve-hook.js';

let registered = false;

// Backcompat loader hook for ESM modules that import CJS subpaths without a .js extension
// e.g. `import set from 'lodash/set'` instead of `import set from 'lodash/set.js'`
// Hooks chain on every registration, so this registers once per thread
export const registerEsmHook = () => {
  if (registered) {
    return;
  }
  registered = true;

  // registerHooks() needs Node 22.15 or 23.5
  const { registerHooks } = module as typeof module & {
    registerHooks?: (hooks: { resolve: typeof resolveSync }) => void;
  };
  if (registerHooks) {
    registerHooks({ resolve: resolveSync });
    return;
  }

  try {
    // Resolve relative to the package entry point so this works both from source
    // (where import.meta.url is src/modules/) and from the bundle (where it's dist/)
    const packageEntry = url.fileURLToPath(
      import.meta.resolve('@openfn/runtime')
    );
    const hookPath = path.join(
      path.dirname(packageEntry),
      'modules/esm-resolve-hook.js'
    );
    module.register(`file://${hookPath}`);
  } catch (e) {
    console.error(e);
  }
};
