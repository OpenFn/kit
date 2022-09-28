import fs from 'node:fs/promises';
import path from 'node:path';
import ensureOpts from './util/ensure-opts';
import compileJob from './compile/load-job';
import loadState from './execute/load-state';
import run from './execute/execute';

// import packageConfig from '../package.json' assert { type: 'json' };

export type Opts = {
  adaptors?: string[];
  compileOnly?: boolean;
  jobPath?: string;
  logger?: any; // TODO
  modulesHome?: string;
  noCompile?: boolean;
  outputPath?: string;
  outputStdout?: boolean;
  silent?: boolean; // no logging
  statePath?: string;
  stateStdin?: string;
  traceLinker?: boolean;
  version?: boolean;
}

// Top level command parser
const parse = async (basePath: string, options: Opts) => {
  if (options.version) {
    return version(options);
  }
  if (options.compileOnly) {
    return compile(basePath, options);
  }
  return execute(basePath, options);
};

export default parse;

const assertPath = (basePath?: string) => {
  if (!basePath) {
    console.error('ERROR: no path provided!');
    console.error('\nUsage:');
    console.error('  open path/to/job.js');
    console.error('\nFor more help do:');
    console.error('  openfn --help ');
    process.exit(1);
  }
}

export const compile = async (basePath: string, options: Opts) => {
  assertPath(basePath);
  // TODO should parse do all the options stuff and pass it downstream?
  // Or should each command have its own options parser?
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
  assertPath(basePath);
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

export const version = async (options: Opts) => {
  // Note that this should ignore silent
  const logger = options.logger || console;

  const src = await fs.readFile(path.resolve('package.json'), 'utf8')
  const pkg = JSON.parse(src);
  logger.log(`@openfn/cli ${pkg.version}`)
  for (const d in pkg.dependencies) {
    if (d.startsWith('@openfn')) {
      const pkgpath = path.resolve(`node_modules/${d}/package.json`)
      const s = await fs.readFile(pkgpath, 'utf8')
      const p = JSON.parse(s);
      logger.log(` - ${d} ${p.version}`)
    }
  }
}