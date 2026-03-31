import { register } from 'node:module';

// Backcompat loader hook for ESM modules that import CJS subpaths without a .js extension
// e.g. `import set from 'lodash/set'` instead of `import set from 'lodash/set.js'`
export const registerEsmHook = () => {
  register(new URL('./modules/esm-resolve-hook.js', import.meta.url));
};
