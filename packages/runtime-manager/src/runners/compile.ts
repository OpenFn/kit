// This function will compile a workflow
// Later we'll add an in-memory cache to prevent the same job
// being compiled twice

import type { Logger } from '@openfn/logger';
import compile, { preloadAdaptorExports, Options } from '@openfn/compiler';
import { getModulePath } from '@openfn/runtime';

const createCompile = (logger: Logger, repoDir: string) => {
  const cache = {};
  return async (plan) => {
    // Compile each job in the exeuction plan
    // A bit like the CLI
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
    return plan;
  };
};

export default createCompile;

// TODO copied out of CLI
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
