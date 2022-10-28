/**
 * To handle dynamic modules, we need to provide our own linker function
 * The tricky bit is this MUST load all linked libraries in the context of the parent module
 * https://nodejs.org/api/html#modulelinklinker
 */
import isModuleInstalled from '../repo/is-module-installed';
import vm, { Module, SyntheticModule, Context } from './experimental-vm';
import { ensureAliasedName, getModulePathFromAlias } from '../repo/util';

export type LinkerOptions = {
  // paths to modules: '@openfn/language-common': './path/to/common.js'
  modulePaths?: Record<string, string>;

  // Unless otherwise specified, modules will be loaded from here (relative to cli dir)
  // TODO DEPRECATED
  modulesHome?: string;

  // path to the module repo
  repo?: string;

  whitelist?: RegExp[]; // whitelist packages which the linker allows to be imported

  trace?: boolean; // log module lookup information
};

export type Linker = (
  specifier: string,
  context: Context,
  options?: LinkerOptions
) => Promise<Module>;

const linker: Linker = async (specifier, context, options = {}) => {
  const { whitelist, trace } = options;
  if (trace) {
    console.log(`[linker] loading module ${specifier}`);
  }
  if (whitelist && !whitelist.find((r) => r.exec(specifier))) {
    throw new Error(`Error: module blacklisted: ${specifier}`);
  }

  const exports = await loadActualModule(specifier, options);

  // TODO: Slightly mad handling for ESM and EJS modules
  // Needs more work
  let target = exports;
  if (exports.__esModule) {
    // CJS
    target = target.default.default; // ?!
  } else {
    // ESM
    // If we import @openfn/language-common@2.0.0-rc3, its named exports are found on the default object
    // Which doesn't seem quite right?
    // This elaborate workaround may help
    if (
      Object.keys(exports).length === 1 &&
      exports.default &&
      Object.keys(exports.default).length > 0
    ) {
      target = target.default;
    }
  }

  const exportNames = Object.keys(target);
  // Wrap up the real module into a Synthetic Module
  const m = new vm.SyntheticModule(
    exportNames,
    function (this: SyntheticModule) {
      for (const e of exportNames) {
        this.setExport(e, target[e]);
      }
    },
    { context }
  );

  // resolve the module
  await m.link(() => new Promise((r) => r({} as Module)));
  await m.evaluate();

  // Return the synthetic module
  return m;
};

// Loads a module as a general specifier or from a specific path
const loadActualModule = async (specifier: string, options: LinkerOptions) => {
  // Lookup the path from an explicit specifier first
  let path = options.modulePaths?.[specifier] || '';
  if (options.trace && path) {
    console.log(`[linker] Loading module ${specifier} from mapped ${path}`);
  }

  // TODO get rid of modulesHome and instead load from the repo
  if (!path) {
    // Load a specifier_version name (even if there's no vesion in the specifieer)
    const alias = await ensureAliasedName(specifier, options.repo);
    const isInstalled = await isModuleInstalled(alias, options.repo);
    if (isInstalled) {
      // TODO this is messy
      path = await getModulePathFromAlias(alias, options.repo);
    }
    // set the path to point to the repo
  }
  // If there's no path and a modulesHome, try to load the module from modulesHome
  if (!path && options.modulesHome) {
    // if loading an openfn module, we need to remove openfn from the path
    // ie @openfn/language-common -> language-common
    // TODO is this true for all namespaced packages?
    // TODO no, I don't think this is right at all!
    //const name = specifier.startsWith('@openfn') ? specifier.split('/').pop() : specifier;
    path = `${options.modulesHome}/${specifier}`;
    if (options.trace) {
      console.log(`[linker] Loading module ${specifier} from ${path}`);
    }
  }

  if (path) {
    try {
      return import(path);
    } catch (e) {
      if (options.trace) {
        console.warn(
          `[linker] Failed to load module ${specifier} from ${path}`
        );
        console.log(e);
      }
      // If we fail to load from a path, fall back to loading from a specifier
    }
  }

  return import(specifier);
};

export default linker;
