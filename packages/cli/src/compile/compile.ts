import compile, { preloadAdaptorExports, Options } from '@openfn/compiler';
import { getModulePath } from '@openfn/runtime';
import createLogger, { COMPILER, Logger } from '../util/logger';
import type { CompileOptions } from './command';

// Load and compile a job from a file, then return the result
// This is designed to be re-used in different CLI steps
export default async (opts: CompileOptions, log: Logger) => {
  log.debug('Loading job...');
  const compilerOptions: Options = await loadTransformOptions(opts, log);
  const job = compile(opts.jobSource || opts.jobPath, compilerOptions);
  if (opts.jobPath) {
    log.success(`Compiled job from ${opts.jobPath}`);
  } else {
    log.success('Compiled job');
  }
  return job;
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
