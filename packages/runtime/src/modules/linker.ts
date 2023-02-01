/**
 * To handle dynamic modules, we need to provide our own linker function
 * The tricky bit is this MUST load all linked libraries in the context of the parent module
 * https://nodejs.org/api/html#modulelinklinker
 */
import { createMockLogger, Logger } from '@openfn/logger';
import vm, { Module, SyntheticModule, Context } from './experimental-vm';
import { getModuleEntryPoint } from './repo';

const defaultLogger = createMockLogger();

export type ModuleInfo = {
  path?: string;
  version?: string;
};

export type ModuleInfoMap = Record<string, ModuleInfo>;

export type LinkerOptions = {
  log?: Logger;

  modules?: ModuleInfoMap;

  // path to the module repo
  repo?: string;

  whitelist?: RegExp[]; // whitelist packages which the linker allows to be imported
};

export type Linker = (
  specifier: string,
  context: Context,
  options?: LinkerOptions
) => Promise<Module>;

const linker: Linker = async (specifier, context, options = {}) => {
  const { whitelist } = options;
  const log = options.log || defaultLogger;
  log.debug(`[linker] loading module ${specifier}`);

  if (whitelist && !whitelist.find((r) => r.exec(specifier))) {
    throw new Error(`Error: module blacklisted: ${specifier}`);
  }

  const exports = await loadActualModule(specifier, options);

  // TODO: Slightly mad handling for ESM and EJS modules
  // Needs more work
  let target = exports;
  if (exports.__esModule && target.default.default) {
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
  const log = options.log || defaultLogger;
  const prefix = process.platform == 'win32' ? 'file://' : '';

  // If the specifier is a path, just import it
  if (specifier.startsWith('/') && specifier.endsWith('.js')) {
    const importPath = `${prefix}${specifier}`;
    log.debug(`[linker] Loading module from path: ${importPath}`);
    return import(importPath);
  }

  // Otherwise resolve the specifier to a path in the repo
  let path;
  let version;

  if (options.modules?.[specifier]) {
    ({ path, version } = options.modules?.[specifier]);
  }

  if (path || options.repo) {
    const specifierWithVersion = version
      ? `${specifier}@${version}`
      : specifier;
    const entry = await getModuleEntryPoint(
      specifierWithVersion,
      path,
      options.repo,
      log
    );
    if (entry) {
      path = entry.path;
      version = entry.version;
    } else {
      log.debug(`module not found in repo: ${specifier}`);
    }
  }

  if (path) {
    log.debug(`[linker] Loading module ${specifier} from ${path}`);
    try {
      const result = import(`${prefix}${path}`);
      if (specifier.startsWith('@openfn/language-')) {
        log.info(`Resolved adaptor ${specifier} to version ${version}`);
      }
      return result;
    } catch (e) {
      log.debug(`[linker] Failed to load module ${specifier} from ${path}`);
    }
  }

  throw new Error(`Failed to load module "${specifier}"`);
};

export default linker;
