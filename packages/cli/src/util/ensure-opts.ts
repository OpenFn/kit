import path from 'node:path';
import { Opts, SafeOpts } from '../commands';
import type { LogOptions } from '@openfn/logger';

export const defaultLoggerOptions = {
  default: 'default',
  runtime: 'trace'
}

export default function ensureOpts(basePath: string = '.', opts: Opts): SafeOpts {
  const newOpts = {
    compileOnly: Boolean(opts.compileOnly),
    modulesHome: opts.modulesHome || process.env.OPENFN_MODULES_HOME,
    noCompile: Boolean(opts.noCompile),
    outputStdout: Boolean(opts.outputStdout),
    silent: opts.silent,
    stateStdin: opts.stateStdin,
    test: opts.test,
    traceLinker: opts.traceLinker,
  } as SafeOpts;

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

  const components: Record<string, LogOptions> = {};
  if (opts.log) {
    opts.log.forEach((l) => {
      if (l.match(/=/)) {
        const [component, level] = l.split('=');
        components[component] = level;
      } else  {
        components.default = l;
      }
    })
    // TODO what if other log options are passed? Not really a concern right now
  } else if (opts.test) {
    // In test mode, log at info level by default
    components.default = 'info';
  }
  newOpts.log = {
    ...defaultLoggerOptions,
    ...components,
  };

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

  return newOpts;
}