import path from 'node:path';
import { Opts} from '../commands';

export type SafeOpts = Required<Opts>;

export default function ensureOpts(basePath: string, opts: Opts): SafeOpts {
  const newOpts = {
    noCompile: Boolean(opts.noCompile),
    compileOnly: Boolean(opts.compileOnly),
    outputStdout: Boolean(opts.outputStdout),
    silent: opts.silent,
    stateStdin: opts.stateStdin,
    traceLinker: opts.traceLinker,
    modulesHome: opts.modulesHome || process.env.OPENFN_MODULES_HOME,
  } as Opts;

  const set = (key: keyof Opts, value: string) => {
    // @ts-ignore TODO
    newOpts[key] = opts.hasOwnProperty(key) ? opts[key] : value;
  };

  let baseDir = basePath;

  if (basePath.endsWith('.js')) {
    baseDir = path.dirname(basePath);
    set('jobPath', basePath)
  } else {
    set('jobPath', `${baseDir}/job.js`)
  }
  set('statePath', `${baseDir}/state.json`)
  if (!opts.outputStdout) {
    set('outputPath', newOpts.compileOnly ? `${baseDir}/output.js` : `${baseDir}/output.json`)  
  }

  // TODO if no adaptor is provided, default to language common
  // Should we go further and bundle language-common?
  // But 90% of jobs use something else. Better to use auto loading.
  if (opts.adaptors) {
    newOpts.adaptors = opts.adaptors;
    // newOpts.adaptors = opts.adaptors.map((adaptor) => {
    //   if (!adaptor.startsWith('@openfn/')) {
    //     return `@openfn/${adaptor}`
    //   }
    //   return adaptor
    // });
  }

  return newOpts as SafeOpts;
}