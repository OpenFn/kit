import path from 'node:path';
import fs from 'node:fs/promises';
import compile from '@openfn/compiler';
import runtime from '@openfn/runtime';


export type Opts = {
  jobPath?: string;
  statePath?: string;
  stateStdin?: string;
  outputPath?: string;
  outputStdout?: boolean;
}

export type SafeOpts = Required<Opts>;

export default async (basePath: string, opts: Opts) => {
  const args = ensureOpts(basePath, opts);
  console.log(`Loading job from ${args.jobPath}`)
  
  const state = await loadState(args);
  // TODO should we resolve this path?
  // What if you're running devtools globally?
  const code = compile(args.jobPath);
  const result = await runtime(code, state);

  if (opts.outputStdout) {
    console.log(`\nResult: `)
    console.log(result)
  } else {
    await writeOutput(args, result);
  }
  console.log(`\nDone! ✨`)
}

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

async function loadState(opts: SafeOpts) {
  if (opts.stateStdin) {
    try {
      return JSON.parse(opts.stateStdin);
    } catch(e) {
      console.error("Failed to load state from stdin")
      console.error(opts.stateStdin);
      process.exit(1);
    }
  }

  try {
    console.warn(`Loading state from ${opts.statePath}`);
    const str = await fs.readFile(opts.statePath, 'utf8')
    return JSON.parse(str)
  } catch(e) {
    console.warn('Error loading state!');
    console.log(e);
  }
  console.log('Using default state')
  return {
    data: {},
    configuration: {}
  };
}

async function writeOutput(opts: SafeOpts, state: any) {
  console.log(`Writing output to ${opts.outputPath}`)
  await fs.writeFile(opts.outputPath, JSON.stringify(state, null, 4));
}