import run, { getNameAndVersion } from '@openfn/runtime';
import type { ExecutionPlan, Job } from '@openfn/lexicon';
import type { ModuleInfo, ModuleInfoMap } from '@openfn/runtime';

import createLogger, { RUNTIME, JOB } from '../util/logger';
import { ExecuteOptions } from './command';

type ExtendedModuleInfo = ModuleInfo & {
  name: string;
};

export default async (
  plan: ExecutionPlan,
  input: any,
  opts: ExecuteOptions
): Promise<any> => {
  try {
    const result = await run(plan, input, {
      immutableState: opts.immutable,
      logger: createLogger(RUNTIME, opts),
      jobLogger: createLogger(JOB, opts),
      linker: {
        repo: opts.repoDir,
        modules: parseAdaptors(plan),
      },
    });
    return result;
  } catch (e: any) {
    // Any error coming out of the runtime should be handled and reported already
    e.handled = true;
    throw e;
  }
};

// TODO we should throw if the adaptor strings are invalid for any reason
export function parseAdaptors(plan: ExecutionPlan) {
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

  // TODO what if there are different versions of the same adaptor?
  // This structure can't handle it - we'd need to build it for every job
  Object.values(plan.workflow.steps).forEach((step) => {
    const job = step as Job;
    if (job.adaptor) {
      const { name, ...maybeVersionAndPath } = extractInfo(job.adaptor);
      adaptors[name] = maybeVersionAndPath;
    }
  });

  return adaptors;
}
