import fs from 'node:fs/promises';
import createLogger from '@openfn/logger';
import ensureOpts, { SafeOpts } from './util/ensure-opts';
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
  silent?: boolean; // no logging (TODO would a null logger be better?)
  statePath?: string;
  stateStdin?: string;
  traceLinker?: boolean;
  test?: boolean;
}

// Top level command parser
const parse = async (basePath: string, options: Opts) => {
  if (options.test) {
    return test(options);
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

const nolog = {
  log: () => {}
};

export const test = async (options: Opts) => {
  const opts = { ... options } as SafeOpts;

  const logger = options.logger || (opts.silent ? nolog : console);

  logger.log('Running test job...')
  logger.log()

  // This is a bit weird but it'll actually work!
  opts.jobPath = `const fn = () => state => state * 2; fn()`;

  if (!opts.stateStdin) {
    logger.log('No state detected: pass -S <number> to provide some state');
    opts.stateStdin = "21";
  }
  
  // TODO need to fix this log API but there's work for that on another branch
  const state = await loadState(opts, nolog.log);
  const code = await compileJob(opts, nolog.log);
  logger.log('Compiled job:')
  logger.log()
  logger.log(code);
  logger.log()
  logger.log('Running job:')
  const result = await run(code, state, opts);
  logger.log()
  logger.log(`Result: ${result}`);
  return result;
};

export const compile = async (basePath: string, options: Opts) => {
  assertPath(basePath);
  // TODO should parse do all the options stuff and pass it downstream?
  // Or should each command have its own options parser?
  const opts = ensureOpts(basePath, options);

  const log = createLogger('Compiler')

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

  const log = createLogger('CLI')

  const state = await loadState(opts, log);
  const code = await compileJob(opts, createLogger('Compiler'));
  // TODO the runtime needs to accept a logger to fed through to jobs
  // Also the runtime will emit, rather than log directly
  // So probably want to log and listen here
  const result = await run(code, state, opts);
  
  if (opts.outputStdout) {
    // TODO Log this even if in silent mode
    log(`\nResult: `)
    log(result)
  } else {
    if (!opts.silent) {
      log(`Writing output to ${opts.outputPath}`)
    }
    await fs.writeFile(opts.outputPath, JSON.stringify(result, null, 4));
  }

  log(`Done! ✨`)
}

// This is disabled for now because
// 1) Resolving paths relative to the install location of the module is tricky
// 2) yargs does a pretty good job of reporting the CLI's version
// export const version = async (options: Opts) => {
//   // Note that this should ignore silent
//   const logger = options.logger || console;
//   const src = await fs.readFile(path.resolve('package.json'), 'utf8')
//   const pkg = JSON.parse(src);
//   logger.log(`@openfn/cli ${pkg.version}`)
//   for (const d in pkg.dependencies) {
//     if (d.startsWith('@openfn')) {
//       const pkgpath = path.resolve(`node_modules/${d}/package.json`)
//       const s = await fs.readFile(pkgpath, 'utf8')
//       const p = JSON.parse(s);
//       logger.log(` - ${d} ${p.version}`)
//     }
//   }
// }