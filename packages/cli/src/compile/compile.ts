import fs from 'node:fs/promises';
import createLogger, { COMPILER, Logger } from '../util/logger';
import compile,{ preloadAdaptorExports, Options } from '@openfn/compiler';
import type { SafeOpts } from '../commands';

// Load and compile a job from a file
export default async (opts: SafeOpts, log: Logger) => {
  log.debug('Loading job...')
  let job;
  if (opts.noCompile) {
    log.info('Skipping compilation as noCompile is set')
    job = fs.readFile(opts.jobPath, 'utf8');
    log.success(`Loaded job from ${opts.jobPath} (no compilation)`)
  } else {
    const complilerOptions: Options = await loadTransformOptions(opts, log);
    complilerOptions.logger = createLogger(COMPILER, opts);
    job = compile(opts.jobPath, complilerOptions);
    log.success(`Compiled job from ${opts.jobPath}`)
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
}

// Mutate the opts object to write export information for the add-imports transformer
export const loadTransformOptions = async (opts: SafeOpts, log: Logger) => {
  const options: Options = {
    logger: log
  };

  // If an adaptor is passed in, we need to look up its declared exports
  // and pass them along to the compiler
  if (opts.adaptors) {
    const [pattern] = opts.adaptors; // TODO add-imports only takes on adaptor, but the cli can take multiple
    const [specifier, path] = pattern.split('=');

    // Preload exports from a path, optionally logging errors in case of a failure
    const doPreload = async (path: string, logError: boolean = true) => {
      try {
        const result =  await preloadAdaptorExports(path);
        if (result) {
          log.info(`Pre-loaded typedefs for ${specifier} from ${path}`)
        }
        return result;
      } catch(e) {
        if (logError) {
          log.error(`Failed to load adaptor typedefs from path ${path}`);
          log.error(e)
        }
      }
    }

    // TODO need better trace/debug output on this I think
    // Looking up the adaptor's type definition is complex. In this order, we should use:
    const exports =
      // 1) An explicit file path
      (path && await doPreload(path)) ||
      // 2) A module defined in the opts.modulesHome folder
      (opts.modulesHome && await doPreload(`${opts.modulesHome}/${specifier}`, false)) ||
      // 3) An npm module specifier
      await doPreload(specifier)
      || [];
      
    if (exports.length === 0) {
      console.warn(`WARNING: no module exports loaded for ${pattern}`)
      console.log ('         automatic imports will be skipped')
    }

    options['add-imports'] = {
      adaptor: {
        name: stripVersionSpecifier(specifier),
        exports,
        exportAll: true,
      }
    };
  }
  return options;
}
