/**
 * To handle dynamic modules, we need to provide our own linker function
 * The tricky bit is this MUST load all linked libraries in the context of the parent module
 * https://nodejs.org/api/vm.html#modulelinklinker
 */
import vm from 'node:vm';

// TODO no typedef available quite yet
type Module = any;

export type Linker = (specifier: string, context: vm.Context)
  => Promise<Module | null> ;

export default async (specifier: string, context: vm.Context, whitelist: RegExp[] = []) => {
  if (whitelist.length && !whitelist.find((r) => r.exec(specifier))) {
    throw new Error(`Error: module blacklisted: ${specifier}`)
  }

  // Load the actual module
  const exports = await import(specifier);
  const exportNames = Object.keys(exports);
  
  // Wrap it up in a Synthetic Module
  // @ts-ignore we have no def for synthetic module
  const m = new vm.SyntheticModule(exportNames, function() {
    for(const e of exportNames) {
      // @ts-ignore 'this' is the synthetic module
      this.setExport(e, exports[e]);
    }
  }, { context })
  
  // resolve the module
  await m.link(() => {});
  await m.evaluate();

  return m;
}