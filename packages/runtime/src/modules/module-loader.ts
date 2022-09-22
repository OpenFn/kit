/**
 * Load an esm module from a string
 */
import vm, { Context } from './experimental-vm';
import mainLinker, { Linker, LinkerOptions } from './linker';

type Options = LinkerOptions & {
  context?: Context;
  linker?: Linker;
}

// Given a source string representing an esm module, evaluate it and return the result
// We expect the module to export default an array of functions
// The function will be validated
export default async (src: string, opts: Options = {}) => {
  validate(src);

  const context = opts.context || vm.createContext();
  const linker = opts.linker || mainLinker;

  const module = new vm.SourceTextModule(src, {
    context
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
    throw new Error(`module loader cannot resolve dependency: ${specifier}`);
  }); 
  // Run the module - exports are written to module.namespace
  await module.evaluate()

  // Return whatever is in the default export
  return module.namespace.default;
}

function validate(_src: string) {  
  // use the compiler to run some basic validation on the string
  // * Only @openfn imports
  // * Should export an array (of functions)
  // Throw if a fail
  return true;
}
