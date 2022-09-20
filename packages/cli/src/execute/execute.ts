import run from '@openfn/runtime';
import type { SafeOpts } from '../util/ensure-opts';

export default (code: string, state: any, opts: SafeOpts): Promise<any> => {
  return run(code, state, {
    linker: {
      modulesHome: opts.modulesHome,
      modulePaths: parseAdaptors(opts),
      trace: opts.traceLinker
    }
  });
}

// TODO we should throw if the adaptor strings are invalid for any reason
function parseAdaptors(opts: SafeOpts) {
  const adaptors: Record<string, string> = {};
  opts.adaptors?.reduce((obj, exp) => {
    const [module, path] = exp.split('=');
    obj[module] = path;
    return obj;
  }, adaptors);
  return adaptors;
}
