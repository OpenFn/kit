import run, { getNameAndVersion } from '@openfn/runtime';
import type { ModuleInfo, ModuleInfoMap, ExecutionPlan } from '@openfn/runtime';
import createLogger, { RUNTIME, JOB } from '../util/logger';
import { ExecuteOptions } from './command';

type ExtendedModuleInfo = ModuleInfo & {
  name: string;
};

// Call's runtime.run
// This may throw in the event of a crash
export default async (
  input: string | ExecutionPlan,
  state: any,
  opts: Omit<ExecuteOptions, 'jobPath'>
): Promise<any> =>
  run(input, state, {
    strict: opts.strict,
    start: opts.start,
    timeout: opts.timeout,
    immutableState: opts.immutable,
    logger: createLogger(RUNTIME, opts),
    jobLogger: createLogger(JOB, opts),
    linker: {
      repo: opts.repoDir,
      modules: parseAdaptors(opts),
    },
  });

// TODO we should throw if the adaptor strings are invalid for any reason
export function parseAdaptors(
  opts: Partial<Pick<ExecuteOptions, 'adaptors' | 'workflow'>>
) {
  const extractInfo = (specifier: string) => {
    const [module, path] = specifier.split('=');
    const { name, version } = getNameAndVersion(module);
    const info: ExtendedModuleInfo = {
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
