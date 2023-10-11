// This function will compile a workflow
// Later we'll add an in-memory cache to prevent the same job
// being compiled twice

import type { Logger } from '@openfn/logger';
import compile, { preloadAdaptorExports } from '@openfn/compiler';
import { getModulePath } from '@openfn/runtime';
import { EngineAPI, WorkflowState } from '../types';
import { RTEOptions } from '../__engine';

// TODO this compiler is going to change anyway to run just in time
// the runtime will have an onCompile hook
// We'll keep this for now though while we get everything else working
export default async (
  api: EngineAPI,
  state: WorkflowState,
  options: Pick<RTEOptions, 'repoDir' | 'noCompile'> = {}
) => {
  const { logger } = api;
  const { plan } = state;
  const { repoDir, noCompile } = options;

  if (!noCompile) {
    for (const job of plan.jobs) {
      if (job.expression) {
        job.expression = await compileJob(
          job.expression as string,
          job.adaptor, // TODO need to expand this. Or do I?
          repoDir,
          logger
        );
      }
    }
  }

  return plan;
};

// TODO copied out of CLI - how can we share code here?
// engine should not have a dependency on the cli
// maybe this is a runtime  util
const stripVersionSpecifier = (specifier: string) => {
  const idx = specifier.lastIndexOf('@');
  if (idx > 0) {
    return specifier.substring(0, idx);
  }
  return specifier;
};

const compileJob = async (
  job: string,
  adaptor: string,
  repoDir: string,
  logger: Logger
) => {
  // TODO I probably dont want to log this stuff
  const pathToAdaptor = await getModulePath(adaptor, repoDir, logger);
  const exports = await preloadAdaptorExports(pathToAdaptor!, false, logger);
  const compilerOptions = {
    logger,
    ['add-imports']: {
      adaptor: {
        name: stripVersionSpecifier(adaptor),
        exports,
        exportAll: true,
      },
    },
  };
  return compile(job, compilerOptions);
};
