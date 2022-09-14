/**
 * To handle dynamic modules, we need to provide our own linker function
 * The tricky bit is this MUST load all linked libraries in the context of the parent module
 * https://nodejs.org/api/html#modulelinklinker
 */
import vm, { Module, SyntheticModule, Context } from './experimental-vm';

export type LinkerOptions = {
  // paths to modules: '@openfn/language-common': './path/to/common.js'
  // What are paths relative to?
  modulePaths?: Record<string, string>;

  // Unless otherwise specified, modules will be loaded from here (relative to cli dir)
  modulesHome?: string;
  
  whitelist?: RegExp[], // whitelist packages which the linker allows to be imported
  
  trace?: boolean; // log module lookup information
}

export type Linker = (specifier: string, context: Context, options?: LinkerOptions) => Promise<Module>;

const linker: Linker = async (specifier, context, options = {}) => {
  const { whitelist, trace } = options;
  if (trace) {
    console.log(`[linker] loading module ${specifier}`)
  }
  if (whitelist && !whitelist.find((r) => r.exec(specifier))) {
    throw new Error(`Error: module blacklisted: ${specifier}`)
  }

  const exports = await loadActualModule(specifier, options);
  const exportNames = Object.keys(exports);
  
  // Wrap up the real module into a Synthetic Module
  const m = new vm.SyntheticModule(exportNames, function(this: SyntheticModule) {
    for(const e of exportNames) {
      this.setExport(e, exports[e]);
    }
  }, { context });
  
  // resolve the module
  await m.link(() => new Promise((r) => r({} as Module)));
  await m.evaluate();

  // Return the synthetic module
  return m;
}

// Loads a module as a general specifier or from a specific path
const loadActualModule = async (specifier: string, options: LinkerOptions) => {
  let path = '';

  // Load a module from a custom folder
  if (options.modulesHome) {
    // if loading an openfn module, we need to remove openfn from the path
    // ie @openfn/language-common -> language-common
    const name = specifier.startsWith('@openfn') ? specifier.split('/').pop() : specifier;
    path = `${options.modulesHome}/${name}`;
  }
  
  if (path) {
    try {
      if (options.trace) {
        console.log(`[linker] Loading module ${specifier} from ${path}`);
      }
      const m = await import(path);
      return m;
    } catch(e) {
      if (options.trace) {
        console.warn(`[linker] Failed to load module ${specifier} from ${path}`);
        console.log(e)
      }
      // If we fail to load from a path, fall back to loading from a specifier
    }
  }

  return import(specifier)
}

export default linker;