import run, { NOTIFY_JOB_COMPLETE, getNameAndVersion } from '@openfn/runtime';
import type { ExecutionPlan, Job } from '@openfn/lexicon';
import type {
  ModuleInfo,
  ModuleInfoMap,
  NotifyJobCompletePayload,
} from '@openfn/runtime';

import createLogger, { RUNTIME, JOB, Logger } from '../util/logger';
import { saveToCache } from '../util/cache';

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
      callbacks: {
        notify: async (eventName, payload) => {
          if (eventName === NOTIFY_JOB_COMPLETE) {
            const { state, jobId } = payload as NotifyJobCompletePayload;
            await saveToCache(plan, jobId, state, opts, logger);
          }
        },
      },
      defaultRunTimeoutMs: 5 * 60 * 1000, // 5 minutes
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

  Object.values(plan.workflow.steps).forEach((step) => {
    const job = step as Job;
    job.adaptors.forEach((adaptor) => {
      const { name, ...maybeVersionAndPath } = extractInfo(adaptor);
      adaptors[name] = maybeVersionAndPath;
    });
  });

  return adaptors;
}
