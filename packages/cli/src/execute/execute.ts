import run, { getNameAndVersion } from '@openfn/runtime';
import type { ModuleInfo, ModuleInfoMap, ExecutionPlan } from '@openfn/runtime';
import createLogger, { RUNTIME, JOB, Logger } from '../util/logger';
import abort from '../util/abort';
import { ExecuteOptions } from './command';

type ExtendedModuleInfo = ModuleInfo & {
  name: string;
};

export default async (
  input: string | ExecutionPlan,
  state: any,
  opts: Omit<ExecuteOptions, 'jobPath'>,
  logger: Logger
): Promise<any> => {
  try {
    const result = await run(input, state, {
      strict: opts.strict,
      start: opts.start,
      timeout: opts.timeout,
      immutableState: opts.immutable,
      logger: createLogger(RUNTIME, opts as any), // TODO log types are flaky right now
      jobLogger: createLogger(JOB, opts as any), // ditto
      linker: {
        repo: opts.repoDir,
        modules: parseAdaptors(opts),
      },
    });
    return result;
  } catch (e: any) {
    // The runtime will throw if it's give something it can't execute
    // TODO Right now we assume this is a validation error (compilation errors should be caught already)
    abort(logger, 'Invalid workflow', e);
  }
};

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
