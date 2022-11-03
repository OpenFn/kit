import fs from 'node:fs/promises';
import compile, { preloadAdaptorExports, Options } from '@openfn/compiler';
import { getModulePath } from '@openfn/runtime';
import createLogger, { COMPILER, Logger } from '../util/logger';
import type { SafeOpts } from '../commands';

// Load and compile a job from a file, then return the result
// This is designed to be re-used in different CLI steps
// TODO - we should accept jobPath and jobSource as different arguments
//        it makes reporting way ieaser
export default async (opts: SafeOpts, log: Logger) => {
  log.debug('Loading job...');
  let job;
  if (opts.noCompile) {
    log.info('Skipping compilation as noCompile is set');
    job = fs.readFile(opts.jobPath, 'utf8');
    log.success(`Loaded job from ${opts.jobPath} (no compilation)`);
  } else {
    const complilerOptions: Options = await loadTransformOptions(opts, log);
    complilerOptions.logger = createLogger(COMPILER, opts);
    job = compile(opts.jobPath, complilerOptions);
    if (opts.jobPath) {
      log.success(`Compiled job from ${opts.jobPath}`);
    } else {
      log.success('Compiled job');
    }
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
  modulesHome: string,
  log: Logger
) => {
  const [specifier, path] = pattern.split('=');

  if (path) {
    // given an explicit path, just load it.
    log.debug(`Resolved ${specifier} to path: ${path}`);
    return path;
  }

  const repoPath = await getModulePath(specifier, modulesHome);
  if (repoPath) {
    log.debug(`Resolved ${specifier} to repo module`);
    return repoPath;
  }
  return null;
};

// Mutate the opts object to write export information for the add-imports transformer
export const loadTransformOptions = async (opts: SafeOpts, log: Logger) => {
  const options: Options = {
    logger: log,
  };

  // If an adaptor is passed in, we need to look up its declared exports
  // and pass them along to the compiler
  if (opts.adaptors) {
    let exports;
    const [pattern] = opts.adaptors; // TODO add-imports only takes on adaptor, but the cli can take multiple
    const [specifier] = pattern.split('=');

    // Preload exports from a path, optionally logging errors in case of a failure
    log.debug(`Attempting to preload typedefs for ${specifier}`);
    const path = await resolveSpecifierPath(pattern, opts.modulesHome, log);
    if (path) {
      try {
        exports = await preloadAdaptorExports(path);
        if (exports) {
          log.info(`Loaded typedefs for ${specifier}`);
        }
      } catch (e) {
        log.error(`Failed to load adaptor typedefs from path ${path}`);
        log.error(e);
      }
    }

    if (!exports || exports.length === 0) {
      console.warn(`WARNING: no module exports found for ${pattern}`);
    }

    options['add-imports'] = {
      adaptor: {
        name: stripVersionSpecifier(specifier),
        exports,
        exportAll: true,
      },
    };
  }
  return options;
};
