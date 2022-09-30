import fs from 'node:fs/promises';
import createLogger, { NamespacedOptions } from '@openfn/logger';
import ensureOpts from './util/ensure-opts';
import compileJob from './compile/load-job';
import loadState from './execute/load-state';
import run from './execute/execute';

export type Opts = {
  adaptors?: string[];
  compileOnly?: boolean;
  jobPath?: string;
  log?: string[];
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

export type SafeOpts = Required<Opts> & {
  log: NamespacedOptions;
};

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

// TODO this is not a good solution
// We shold use log levels in the components to get this effect
// ALso, if --silent is passed in the CLI, we need to respect that
const nolog = {
  log: () => {},
  debug: () => {},
  success: () => {}
};

export const test = async (options: Opts) => {
  const opts = { ... options } as SafeOpts;

  // const logger = options.logger || (opts.silent ? nolog : console);
  // const code = await compileJob(opts, createLogger('Compiler'));
  const logger = createLogger('CLI')

  logger.log('Running test job...')

  // This is a bit weird but it'll actually work!
  opts.jobPath = `const fn = () => state => state * 2; fn()`;

  if (!opts.stateStdin) {
    logger.warn('No state detected: pass -S <number> to provide some state');
    opts.stateStdin = "21";
  }
  
  // TODO need to fix this log API but there's work for that on another branch
  const state = await loadState(opts, nolog);
  const code = await compileJob(opts, logger);
  logger.break()
  logger.info('Compiled job:', '\n', code) // TODO there's an ugly intend here
  logger.break()
  logger.info('Running job...')
  const result = await run(code, state, opts);
  logger.success(`Result: ${result}`);
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
  const cliLogger = createLogger('CLI', opts.log);

  const state = await loadState(opts, cliLogger);
  const code = await compileJob(opts, cliLogger);
  // TODO the runtime needs to accept a logger to fed through to jobs
  // Also the runtime will emit, rather than log directly
  // So probably want to log and listen here
  const result = await run(code, state, opts);
  
  if (opts.outputStdout) {
    // TODO Log this even if in silent mode
    cliLogger.success(`Result: `)
    cliLogger.success(result)
  } else {
    if (!opts.silent) {
      cliLogger.success(`Writing output to ${opts.outputPath}`)
    }
    await fs.writeFile(opts.outputPath, JSON.stringify(result, null, 4));
  }

  cliLogger.success(`Done! ✨`)
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