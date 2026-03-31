import { register } from 'node:module';
import path from 'node:path';
import url from 'node:url';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Backcompat loader hook for ESM modules that import CJS subpaths without a .js extension
// e.g. `import set from 'lodash/set'` instead of `import set from 'lodash/set.js'`
export const registerEsmHook = () => {
  try {
    register(`file://${dirname}/modules/esm-resolve-hook.js`);
  } catch (e) {
    console.error(e);
  }
};
