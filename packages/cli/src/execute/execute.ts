import run, { getNameAndVersion } from '@openfn/runtime';
import type { ModuleInfo, ModuleInfoMap, ExecutionPlan } from '@openfn/runtime';
import createLogger, { RUNTIME, JOB } from '../util/logger';
import { ExecuteOptions } from './command';

// TODO job and workflow are both on the options object, can we just take opts?
export default (
  input: string | ExecutionPlan,
  state: any,
  opts: Omit<ExecuteOptions, 'jobPath'>
): Promise<any> => {
  // TODO listen to runtime events and log them
  // events appeal because we don't have to pass two loggers into the runtime
  // we can just listen to runtime events and do the logging ourselves here
  // Then again, maybe that doesn't make sense
  // Maybe we have to feed a job logger in?
  return run(input, state, {
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
export function parseAdaptors(
  opts: Partial<Pick<ExecuteOptions, 'adaptors' | 'workflow'>>
) {
  const extractInfo = (specifier: string) => {
    const [module, path] = specifier.split('=');
    const { name, version } = getNameAndVersion(module);
    const info: ModuleInfo = {
      name,
    };
    if (path) {
      info.path = path;
    }
    if (version) {
      info.version = version;
    }
    return info;
  };

  const adaptors: ModuleInfoMap = {};

  if (opts.adaptors) {
    opts.adaptors.reduce((obj, exp) => {
      const { name, ...maybeVersionAndPath } = extractInfo(exp);
      obj[name] = { ...maybeVersionAndPath };
      return obj;
    }, adaptors);
  }

  if (opts.workflow) {
    // TODO what if there are different versions of the same adaptor?
    // This structure can't handle it - we'd need to build it for every job
    Object.values(opts.workflow.jobs).forEach((job) => {
      if (job.adaptor) {
        const { name, ...maybeVersionAndPath } = extractInfo(job.adaptor);
        adaptors[name] = { ...maybeVersionAndPath };
      }
    });
  }

  return adaptors;
}
