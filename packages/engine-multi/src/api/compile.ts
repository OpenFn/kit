import compile, { preloadAdaptorExports, Options } from '@openfn/compiler';
import { getModulePath, getNameAndVersion } from '@openfn/runtime';
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
          job.expression = await compileJob(job, logger, repoDir);
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

const compileJob = async (job: Job, logger: Logger, repoDir?: string) => {
  const { expression, adaptors, linker } = job;
  const compilerOptions: Options = {
    logger,
  };

  if (adaptors && repoDir) {
    const adaptorConfig = [];
    for (const adaptor of adaptors) {
      const { name } = getNameAndVersion(adaptor);

      // Support local versions by looking in job.linker for a local path to the adaptor
      const pathToAdaptor =
        linker && linker[name]
          ? linker[name].path
          : await getModulePath(adaptor, repoDir, logger);
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
  return compile(expression, compilerOptions);
};
