import fs from 'node:fs/promises';
import compile,{ preloadAdaptorExports, TransformOptions } from '@openfn/compiler';
import type { SafeOpts } from '../ensure-opts';

const defaultLogger = console.log;

// Load and compile a job from a file
export default async (opts: SafeOpts, log = defaultLogger) => {
  log(`Loading job from ${opts.jobPath}`)

  if (opts.noCompile) {
    log('Skipping compilation')
    return fs.readFile(opts.jobPath, 'utf8');
  } else {
    log('Compiling job source');
    const options: TransformOptions = await loadTransformOptions(opts);
    return compile(opts.jobPath, options);
  }
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
export const loadTransformOptions = async (opts: SafeOpts) => {
  const options: TransformOptions  = {};
  // If an adaptor is passed in, we need to lool up its declared exports
  // and pass them along to the compiler
  if (opts.adaptors) {
    const [pattern] = opts.adaptors; // TODO add-imports only takes on adaptor, but the cli can take multiple
    const [specifier, path] = pattern.split('=');
    // TODO need better trace/debug output on this I think
    // Looking up the adaptor's type definition is complex. In this order, we should use:
    const exports =
      // 1) An explicit file path
      (path && await doPreload(path)) ||
      // 2) A module defined in the opts.modulesHome folder
      (opts.modulesHome && await doPreload(`${opts.modulesHome}/${specifier}`, false)) ||
      // 3) An npm module specifier
      await doPreload(specifier);

    if (exports) {
      options['add-imports'] = {
        adaptor: {
          name: stripVersionSpecifier(specifier),
          exports
        }
      };
    } else {
      console.error(`Failed to load exports for ${pattern}`)
    }
  }
  return options;
}

// Preload exports from a path, optionally logging errors in case of a failure
const doPreload = async (path: string, logError: boolean = true) => {
  try {
     return await preloadAdaptorExports(path);
  } catch(e) {
    if (logError) {
      console.error(`error processing adaptors from path ${path}`);
      console.error(e)
    }
  }
}

