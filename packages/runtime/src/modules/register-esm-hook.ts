import { register } from 'node:module';
import path from 'node:path';
import url from 'node:url';

// Backcompat loader hook for ESM modules that import CJS subpaths without a .js extension
// e.g. `import set from 'lodash/set'` instead of `import set from 'lodash/set.js'`
export const registerEsmHook = () => {
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
    register(`file://${hookPath}`);
  } catch (e) {
    console.error(e);
  }
};
