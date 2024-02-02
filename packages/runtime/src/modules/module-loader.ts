/**
 * Load an esm module from a string
 */
import vm, { Context } from './experimental-vm';
import mainLinker, { Linker, LinkerOptions } from './linker';

import type { Operation } from '@openfn/lexicon';
import type { Logger } from '@openfn/logger';

type Options = LinkerOptions & {
  context?: Context;
  linker?: Linker;
  log?: Logger;
};

// aka ModuleDescriptor?
export type LoadedJob = {
  default: Operation[];
  execute?: (...fns: Operation[]) => (state: any) => any;
};

// Very generic description of a module's exports
export type ModuleExports = Record<'default' | string, any>;

// Loads an ESM source string and returns the operation queue and execute function (if present)
// The function will be validated
// TODO actually, validation should probably be left to the runtime manager
// the runtime itself should naive
export default async (
  src: string,
  opts: Options = {}
): Promise<ModuleExports> => {
  validate(src);

  const context = opts.context || vm.createContext();
  const linker = opts.linker || mainLinker;

  const module = new vm.SourceTextModule(src, {
    context,
  });

  // We need to provide a linker to handle import statements
  // https://nodejs.org/api/vm.html#modulelinklinker
  await module.link(async (specifier: string) => {
    if (linker) {
      const result = await linker(specifier, context, opts);
      if (result) {
        return result;
      }
    }

    // TODO where does this throw to...?
    throw new Error(`module loader cannot resolve dependency: ${specifier}`);
  });
  // Run the module - exports are written to module.namespace
  await module.evaluate();

  return module.namespace;
};

function validate(_src: string) {
  // use the compiler to run some basic validation on the string
  // * Only @openfn imports
  // * Should export an array (of functions)
  // Throw if a fail
  return true;
}
