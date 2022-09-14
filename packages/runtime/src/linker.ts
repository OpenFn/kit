/**
 * To handle dynamic modules, we need to provide our own linker function
 * The tricky bit is this MUST load all linked libraries in the context of the parent module
 * https://nodejs.org/api/html#modulelinklinker
 */
import vm from 'node:vm';

// TODO no typedef available yet
type Module = any;

export type LinkerOptions = {
  // paths to modules: '@openfn/language-common': './path/to/common.js'
  // What are paths relative to?
  modulePaths?: Record<string, string>,

  // Unless otherwise specified, modules will be loaded from here (relative to cli dir)
  modulesHome?: string;
  // Unless otherwise specified, openfn modules will be loaded from here (relative to cli dir)
  openfnHome?: string;

  whitelist?: RegExp[], // whitelist packages which the linker allows to be imported

  trace?: boolean; // log module lookup information
}

export type Linker = (specifier: string, context: vm.Context)
  => Promise<Module | null> ;

export default async (specifier: string, context: vm.Context, options: LinkerOptions = {}) => {
  const { whitelist, trace } = options;
  if (trace) {
    console.log(`[linker] loading module ${specifier}`)
  }
  if (whitelist && !whitelist.find((r) => r.exec(specifier))) {
    throw new Error(`Error: module blacklisted: ${specifier}`)
  }

  const exports = await loadActualModule(specifier, options);
  const exportNames = Object.keys(exports);
  
  // Wrap up the module into aa Synthetic Module
  // @ts-ignore we have no def for synthetic module
  const m = new vm.SyntheticModule(exportNames, function() {
    for(const e of exportNames) {
      // @ts-ignore 'this' is the untyped synthetic module
      this.setExport(e, exports[e]);
    }
  }, { context })
  
  // resolve the module
  await m.link(() => {});
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
