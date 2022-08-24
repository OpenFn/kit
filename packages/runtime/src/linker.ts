/**
 * To handle dynamic modules, we need to provide our own linker function
 * The tricky bit is this MUST load all linked libraries in the context of the parent module
 * https://nodejs.org/api/vm.html#modulelinklinker
 */
import vm from 'node:vm';

// TODO
type Module = any;

export type Linker = (specifier: string, context: vm.Context) => Promise<Module | null> 

export default async (_specifier: string, _context: vm.Context) => {
  return null;
}