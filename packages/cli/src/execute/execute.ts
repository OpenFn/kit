import run, { getNameAndVersion } from '@openfn/runtime';
import type { ModuleInfo, ModuleInfoMap } from '@openfn/runtime';
import createLogger, { RUNTIME, JOB } from '../util/logger';
import type { SafeOpts } from '../commands';
import { ExecuteOptions } from './command';

export default (
  code: string,
  state: any,
  opts: Omit<ExecuteOptions, 'jobPath'>
): Promise<any> => {
  // TODO listen to runtime events and log them
  // events appeal because we don't have to pass two loggers into the runtime
  // we can just listen to runtime events and do the logging ourselves here
  // Then again, maybe that doesn't make sense
  // Maybe we have to feed a job logger in?
  return run(code, state, {
    timeout: opts.timeout,
    immutableState: opts.immutable,
    logger: createLogger(RUNTIME, opts as any), // TODO log types are flaky right now
    jobLogger: createLogger(JOB, opts as any), // ditto
    linker: {
      repo: opts.repoDir,
      modules: parseAdaptors(opts),
    },
  });
};

// TODO we should throw if the adaptor strings are invalid for any reason
export function parseAdaptors(opts: Pick<SafeOpts, 'adaptors'>) {
  const adaptors: ModuleInfoMap = {};
  opts.adaptors.reduce((obj, exp) => {
    const [module, path] = exp.split('=');
    const { name, version } = getNameAndVersion(module);
    const info: ModuleInfo = {};
    if (path) {
      info.path = path;
    }
    if (version) {
      info.version = version;
    }
    obj[name] = info;
    return obj;
  }, adaptors);
  return adaptors;
}
