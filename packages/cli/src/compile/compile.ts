import compile, { preloadAdaptorExports, Options } from '@openfn/compiler';
import { getModulePath, ExecutionPlan } from '@openfn/runtime';
import createLogger, { COMPILER, Logger } from '../util/logger';
import abort from '../util/abort';
import type { CompileOptions } from './command';

// Load and compile a job from a file, then return the result
// This is designed to be re-used in different CLI steps
export default async (opts: CompileOptions, log: Logger) => {
  log.debug('Compiling...');
  let job;
  if (opts.workflow) {
    job = compileWorkflow(opts.workflow, opts, log);
  } else {
    job = await compileJob((opts.job || opts.jobPath) as string, opts, log);
  }

  if (opts.jobPath) {
    log.success(`Compiled from ${opts.jobPath}`);
  } else {
    log.success('Compilation complete');
  }
  return job;
};

const compileJob = async (
  job: string,
  opts: CompileOptions,
  log: Logger,
  jobName?: string
) => {
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
  }
};

// Find every expression in the job and run the compiler on it
const compileWorkflow = async (
  workflow: ExecutionPlan,
  opts: CompileOptions,
  log: Logger
) => {
  for (const job of workflow.jobs) {
    const jobOpts = {
      ...opts,
    };
    if (job.adaptor) {
      jobOpts.adaptors = [job.adaptor];
    }
    if (job.expression) {
      job.expression = await compileJob(
        job.expression as string,
        opts,
        log,
        job.id
      );
    }
  }
  return workflow;
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
    log.debug(`Attempting to preload types for ${specifier}`);
    const path = await resolveSpecifierPath(pattern, opts.repoDir, log);
    if (path) {
      try {
        exports = await preloadAdaptorExports(
          path,
          opts.useAdaptorsMonorepo,
          log
        );
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
