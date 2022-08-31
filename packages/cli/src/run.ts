import path from 'node:path';
import compile from '@openfn/compiler';
import runtime from '@openfn/runtime';

export type Opts = {
  jobPath?: string;
  statePath?: string;
  outputPath?: string;
  outputStdout?: boolean;

  // TODO accept custom compilers and runtimes?
}

export type SafeOpts = Required<Opts>;


export default async (basePath: string, opts: Opts) => {
  console.log(' **** ')
  const args = ensureOpts(basePath, opts);

  const state = loadState(args);
  const code = compile(args.jobPath);
  const result = await runtime(code, state);

  if (opts.outputStdout) {
    console.log(result)
  } else {
    writeOutput(args, result);
  }

}

// TODO should all paths be absolute by now?
// Maybe resolution is later?
export function ensureOpts(basePath: string, opts: Opts): SafeOpts {
  const newOpts = {
    outputStdout: opts.outputStdout ?? false,
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

  return newOpts as SafeOpts;
}

function loadState(opts: SafeOpts) {
  opts; // TODO read the state in
  return {
    data: {},
    configuration: {}
  };
}

// function writeOutput(opts:Opts, state: any) {

// }