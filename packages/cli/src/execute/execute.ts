import run from '@openfn/runtime';
import createLogger, { RUNTIME, JOB } from '../util/logger';
import type { SafeOpts } from '../commands';

export default (code: string, state: any, opts: SafeOpts): Promise<any> => {
  // TODO listen to runtime events and log them
  // events appeal because we don't have to pass two loggers into the runtime
  // we can just listen to runtime events and do the logging ourselves here
  // Then again, maybe that doesn't make sense
  // Maybe we have to feed a job logger in?
  return run(code, state, {
    logger: createLogger(RUNTIME, opts),
    jobLogger: createLogger(JOB, opts),
    linker: {
      modulesHome: opts.modulesHome,
      modulePaths: parseAdaptors(opts),
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
