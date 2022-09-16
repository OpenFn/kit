import fs from 'node:fs/promises';
import compile,{ preloadAdaptorExports, TransformOptions } from '@openfn/compiler';
import run from '@openfn/runtime';
import ensureOpts from './ensure-opts';

export type Opts = {
  silent?: boolean; // no logging
  jobPath?: string;
  statePath?: string;
  stateStdin?: string;
  outputPath?: string;
  outputStdout?: boolean;
  modulesHome?: string;
  adaptors?: string[];
  noCompile?: boolean;
  traceLinker?: boolean;
}

// TODO this is a bit of a temporary solution
// Adaptors need a version specifier right now to load type definitions for auto import
// But that specifier must be excluded in the actual import by the adaptor
const stripVersionSpecifier = (specifier: string) => {
  const idx = specifier.lastIndexOf('@');
  if (idx > 0) {
    return specifier.substring(0, idx);
  }
  return specifier;
}

export default async (basePath: string, options: Opts) => {
  const opts = ensureOpts(basePath, options);

  const log = (...args: any) => {
    if (!opts.silent) {
      console.log(...args);
    }
  };

  const writeOutput = async (state: any) => {
    if (!opts.silent) {
      console.log(`Writing output to ${opts.outputPath}`)
    }
    await fs.writeFile(opts.outputPath, JSON.stringify(state, null, 4));
  }

  const loadState = async () => {
    if (opts.stateStdin) {
      try {
        log('Reading state from stdin')
        return JSON.parse(opts.stateStdin);
      } catch(e) {
        console.error("Failed to load state from stdin")
        console.error(opts.stateStdin);
        process.exit(1);
      }
    }

    try {
      log(`Loading state from ${opts.statePath}`);
      const str = await fs.readFile(opts.statePath, 'utf8')
      return JSON.parse(str)
    } catch(e) {
      console.warn('Error loading state!');
      console.log(e);
    }
    log('Using default state')
    return {
      data: {},
      configuration: {}
    };
  }

  const loadJob = async () => {
    log(`Loading job from ${opts.jobPath}`)

    if (opts.noCompile) {
      log('Skipping compilation')
      return fs.readFile(opts.jobPath, 'utf8');
    } else {
      log('Compiling job source');
      // if there's an adaptor, loads its type defs
      const options: TransformOptions = {};
      if (opts.adaptors) {
        const [pattern] = opts.adaptors; // TODO add-imports only takes on adaptor, but the cli can take multiple
        const [specifier, path] = pattern.split('=');
        const exportSpecifier = path || specifier
        try {
          const exports = await preloadAdaptorExports(exportSpecifier);
          options['add-imports'] = {
            adaptor: {
              name: stripVersionSpecifier(specifier),
              exports
            }
          };
        }
        catch (e) {
          console.error("error processing adaptors")
          console.error(` specifier: ${exportSpecifier}`);
          console.error(e)
        }
      }
      return compile(opts.jobPath, options);
    }
  };

  const state = await loadState();
  const code = await loadJob();
  const result = await run(code, state, {
    linker: {
      modulesHome: options.modulesHome || process.env.OPENFN_MODULES_HOME,
      modulePaths: parseAdaptors(options),
      trace: options.traceLinker
    }
  });

  if (opts.outputStdout) {
    // Log this even if in silent mode
    console.log(`\nResult: `)
    console.log(result)
  } else {
    await writeOutput(result);
  }

  log(`\nDone! ✨`)
}

// TODO we should throw if the adaptor strings are invalid for any reason
function parseAdaptors(opts: Opts) {
  const adaptors: Record<string, string> = {};
  opts.adaptors?.reduce((obj, exp) => {
    const [module, path] = exp.split('=');
    obj[module] = path;
    return obj;
  }, adaptors);
  return adaptors;
}
