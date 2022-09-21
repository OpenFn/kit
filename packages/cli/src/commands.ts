import fs from 'node:fs/promises';
import ensureOpts from './util/ensure-opts';
import compileJob from './compile/load-job';
import loadState from './execute/load-state';
import run from './execute/execute';

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
  compileOnly?: boolean;
  traceLinker?: boolean;
}

export const compile = async (basePath: string, options: Opts) => {
  const opts = ensureOpts(basePath, options);

  const log = (...args: any) => {
    if (!opts.silent) {
      console.log(...args);
    }
  };

  const code = await compileJob(opts, log);
  if (opts.outputStdout) {
    // Log this even if in silent mode
    console.log(code)
  } else {
    if (!opts.silent) {
      console.log(`Writing output to ${opts.outputPath}`)
    }
    await fs.writeFile(opts.outputPath, code);
  }
};

export const execute = async (basePath: string, options: Opts) => {
  const opts = ensureOpts(basePath, options);

  const log = (...args: any) => {
    if (!opts.silent) {
      console.log(...args);
    }
  };

  const state = await loadState(opts, log);
  const code = await compileJob(opts, log);
  const result = await run(code, state, opts);
  
  if (opts.outputStdout) {
    // Log this even if in silent mode
    console.log(`\nResult: `)
    console.log(result)
  } else {
    if (!opts.silent) {
      console.log(`Writing output to ${opts.outputPath}`)
    }
    await fs.writeFile(opts.outputPath, JSON.stringify(result, null, 4));
  }

  log(`\nDone! ✨`)
}

export default execute;