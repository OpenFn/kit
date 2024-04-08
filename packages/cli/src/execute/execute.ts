import run, { NOTIFY_JOB_COMPLETE, getNameAndVersion } from '@openfn/runtime';
import type { ExecutionPlan, Job } from '@openfn/lexicon';
import type { ModuleInfo, ModuleInfoMap, NotifyJobCompletePayload } from '@openfn/runtime';

import createLogger, { RUNTIME, JOB, Logger } from '../util/logger';
import { saveToCache } from '../util/cache'

import type { ExecuteOptions } from './command';

type ExtendedModuleInfo = ModuleInfo & {
  name: string;
};

export default async (
  plan: ExecutionPlan,
  input: any,
  opts: ExecuteOptions,
  logger: Logger
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
      // I need to intercept state after each job here
      callbacks: {
      notify: async (eventName, payload) => {
        if (eventName === NOTIFY_JOB_COMPLETE) {
          const { state, jobId } = payload as NotifyJobCompletePayload
          await saveToCache(plan, jobId, state, opts, logger)
        }
      }
    }
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
