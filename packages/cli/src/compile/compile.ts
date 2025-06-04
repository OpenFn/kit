import compile, {
  preloadAdaptorExports,
  Options,
  getExports,
} from '@openfn/compiler';
import { getModulePath } from '@openfn/runtime';
import type {
  ExecutionPlan,
  Job,
  SourceMapWithOperations,
} from '@openfn/lexicon';

import createLogger, { COMPILER, Logger } from '../util/logger';
import abort from '../util/abort';
import type { CompileOptions } from './command';

export type CompiledJob = { code: string; map?: SourceMapWithOperations };

export default async function (
  job: ExecutionPlan,
  opts: CompileOptions,
  log: Logger
): Promise<ExecutionPlan>;

export default async function (
  plan: string,
  opts: CompileOptions,
  log: Logger
): Promise<CompiledJob>;

export default async function (
  planOrPath: string | ExecutionPlan,
  opts: CompileOptions,
  log: Logger
): Promise<CompiledJob | ExecutionPlan> {
  if (typeof planOrPath === 'string') {
    const result = await compileJob(planOrPath as string, opts, log);
    log.success(`Compiled expression from ${opts.expressionPath}`);
    return result;
  }

  const compiledPlan = await compileWorkflow(
    planOrPath as ExecutionPlan,
    opts,
    log
  );
  log.success('Compiled all expressions in workflow');

  return compiledPlan;
}

const compileJob = async (
  job: string,
  opts: CompileOptions,
  log: Logger,
  jobName?: string
): Promise<CompiledJob> => {
  try {
    const compilerOptions: Options = await loadTransformOptions(opts, log);
    return compile(job, compilerOptions);
  } catch (e: any) {
    abort(
      log,
      `Failed to compile job ${jobName ?? ''}`.trim(),
      e,
      'Check the syntax of the job expression:\n\n' + job
    );
    // This will never actually execute
    return { code: job };
  }
};

// Find every expression in the job and run the compiler on it
const compileWorkflow = async (
  plan: ExecutionPlan,
  opts: CompileOptions,
  log: Logger
) => {
  let globalsIgnoreList: string[] = [];
  if (plan.workflow.globals)
    globalsIgnoreList = getExports(plan.workflow.globals);

  for (const step of plan.workflow.steps) {
    const job = step as Job;
    const jobOpts = {
      ...opts,
      adaptors: job.adaptors ?? opts.adaptors,
      ignoreImports: globalsIgnoreList,
    };
    if (job.expression) {
      const { code, map } = await compileJob(
        job.expression as string,
        jobOpts,
        log,
        job.id
      );
      job.expression = code;
      job.sourceMap = map;
    }
  }
  return plan;
};

// TODO this is a bit of a temporary solution
// Adaptors need a version specifier right now to load type definitions for auto import
// But that specifier must be excluded in the actual import by the adaptor
export const stripVersionSpecifier = (specifier: string) => {
  const idx = specifier.lastIndexOf('@');
  if (idx > 0) {
    return specifier.substring(0, idx);
  }
  return specifier;
};

// Take a module path as provided by the CLI and convert it into a path
export const resolveSpecifierPath = async (
  pattern: string,
  repoDir: string | undefined,
  log: Logger
) => {
  const [specifier, path] = pattern.split('=');

  if (path) {
    // given an explicit path, just load it.
    log.debug(`Resolved ${specifier} to path: ${path}`);
    return path;
  }

  const repoPath = await getModulePath(specifier, repoDir, log);
  if (repoPath) {
    return repoPath;
  }
  return null;
};

// Mutate the opts object to write export information for the add-imports transformer
export const loadTransformOptions = async (
  opts: CompileOptions,
  log: Logger
) => {
  const options: Options = {
    logger: log || createLogger(COMPILER, opts as any),
  };
  // If an adaptor is passed in, we need to look up its declared exports
  // and pass them along to the compiler
  if (opts.adaptors?.length && opts.ignoreImports != true) {
    const adaptorsConfig = [];
    for (const adaptorInput of opts.adaptors) {
      let exports;
      const [specifier] = adaptorInput.split('=');

      // Preload exports from a path, optionally logging errors in case of a failure
      log.debug(`Trying to preload types for ${specifier}`);
      const path = await resolveSpecifierPath(adaptorInput, opts.repoDir, log);
      if (path) {
        try {
          exports = await preloadAdaptorExports(path, log);
        } catch (e) {
          log.error(`Failed to load adaptor typedefs from path ${path}`);
          log.error(e);
        }
      }

      if (!exports || exports.length === 0) {
        log.debug(`No module exports found for ${adaptorInput}`);
      }

      adaptorsConfig.push({
        name: stripVersionSpecifier(specifier),
        exports,
        exportAll: true,
      });
    }

    options['add-imports'] = {
      ignore: opts.ignoreImports as string[],
      adaptors: adaptorsConfig,
    };
  }

  return options;
};
