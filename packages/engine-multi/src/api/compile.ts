import compile, { preloadAdaptorExports, Options } from '@openfn/compiler';
import { getModulePath } from '@openfn/runtime';
import type { Job } from '@openfn/lexicon';
import type { Logger } from '@openfn/logger';

import { CompileError } from '../errors';
import type ExecutionContext from '../classes/ExecutionContext';

// TODO this compiler is going to change anyway to run just in time
// the runtime will have an onCompile hook
// We'll keep this for now though while we get everything else working
export default async (context: ExecutionContext) => {
  const { logger, state, options } = context;
  const { repoDir, noCompile } = options;

  if (!noCompile && state.plan?.workflow.steps?.length) {
    for (const step of state.plan.workflow.steps) {
      const job = step as Job;
      if (job.expression) {
        try {
          job.expression = await compileJob(
            job.expression as string,
            logger,
            repoDir,
            job.adaptors
          );
        } catch (e) {
          throw new CompileError(e, job.id!);
        }
      }
    }
  }
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
  logger: Logger,
  repoDir?: string,
  adaptors?: string[]
) => {
  const compilerOptions: Options = {
    logger,
  };

  if (adaptors && repoDir) {
    const adaptorConfig = [];
    for (const adaptor of adaptors) {
      // TODO I probably don't want to log this stuff
      const pathToAdaptor = await getModulePath(adaptor, repoDir, logger);
      const exports = await preloadAdaptorExports(pathToAdaptor!, logger);
      adaptorConfig.push({
        name: stripVersionSpecifier(adaptor),
        exports,
        exportAll: true,
      });
    }
    compilerOptions['add-imports'] = {
      adaptors: adaptorConfig,
    };
  }
  return compile(job, compilerOptions);
};
