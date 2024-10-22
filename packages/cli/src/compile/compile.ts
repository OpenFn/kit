import compile, { preloadAdaptorExports, Options } from '@openfn/compiler';
import { getModulePath } from '@openfn/runtime';
import type { ExecutionPlan, Job } from '@openfn/lexicon';

import createLogger, { COMPILER, Logger } from '../util/logger';
import abort from '../util/abort';
import type { CompileOptions } from './command';

// Load and compile a job from a file, then return the result
// This is designed to be re-used in different CLI steps
export default async (
  planOrPath: ExecutionPlan | string,
  opts: CompileOptions,
  log: Logger
) => {
  if (typeof planOrPath === 'string') {
    const result = await compileJob(planOrPath as string, opts, log);
    log.success(`Compiled expression from ${opts.expressionPath}`);
    return result;
  }

  const compiledPlan = compileWorkflow(planOrPath as ExecutionPlan, opts, log);
  log.success('Compiled all expressions in workflow');

  return compiledPlan;
};

const compileJob = async (
  job: string,
  opts: CompileOptions,
  log: Logger,
  jobName?: string
): Promise<string> => {
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
    // This will never actully execute
    return '';
  }
};

// Find every expression in the job and run the compiler on it
const compileWorkflow = async (
  plan: ExecutionPlan,
  opts: CompileOptions,
  log: Logger
) => {
  for (const step of plan.workflow.steps) {
    const job = step as Job;
    const jobOpts = {
      ...opts,
    };
    if (job.adaptor) {
      jobOpts.adaptors = [job.adaptor];
    }
    if (job.expression) {
      job.expression = await compileJob(
        job.expression as string,
        jobOpts,
        log,
        job.id
      );
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
    let exports;
    const [pattern] = opts.adaptors;
    const [specifier] = pattern.split('=');

    // Preload exports from a path, optionally logging errors in case of a failure
    log.debug(`Trying to preload types for ${specifier}`);
    const path = await resolveSpecifierPath(pattern, opts.repoDir, log);
    if (path) {
      try {
        exports = await preloadAdaptorExports(path, log);
      } catch (e) {
        log.error(`Failed to load adaptor typedefs from path ${path}`);
        log.error(e);
      }
    }

    if (!exports || exports.length === 0) {
      log.debug(`No module exports found for ${pattern}`);
    }

    options['add-imports'] = {
      ignore: opts.ignoreImports as string[],
      adaptor: {
        name: stripVersionSpecifier(specifier),
        exports,
        exportAll: true,
      },
    };
  }

  return options;
};
