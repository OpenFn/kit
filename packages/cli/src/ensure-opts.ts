import path from 'node:path';
import { Opts} from './execute';

export type SafeOpts = Required<Opts>;

export default function ensureOpts(basePath: string, opts: Opts): SafeOpts {
  const newOpts = {
    outputStdout: opts.outputStdout ?? false,
    silent: opts.silent,
    noCompile: opts.noCompile,
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
    set('outputPath', `${baseDir}/output.json`)  
  }
  if (opts.adaptors) {
    newOpts.adaptors = opts.adaptors.map((adaptor) => {
      if (!adaptor.startsWith('@openfn/')) {
        return `@openfn/${adaptor}`
      }
      return adaptor
    });
  }

  return newOpts as SafeOpts;
}