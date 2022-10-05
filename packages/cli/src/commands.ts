import fs from 'node:fs/promises';
import createLogger, { createNullLogger, Logger, LogLevel } from './util/logger'; 
import ensureOpts from './util/ensure-opts';
import compile from './compile/compile';
import loadState from './execute/load-state';
import execute from './execute/execute';

export type Opts = {
  adaptors?: string[];
  compileOnly?: boolean;
  jobPath?: string;
  log?: string[];
  modulesHome?: string;
  noCompile?: boolean;
  outputPath?: string;
  outputStdout?: boolean;
  silent?: boolean; // DEPRECATED
  statePath?: string;
  stateStdin?: string;
  traceLinker?: boolean;
  test?: boolean;
}

export type SafeOpts = Required<Omit<Opts, "log">> & {
  log: Record<string, LogLevel>;
};

// Top level command parser
const parse = async (basePath: string, options: Opts, log?: Logger) => {
  // TODO allow a logger to be passed in for test purposes
  // I THINK I need this but tbh not sure yet!
  const opts = ensureOpts(basePath, options);
  const logger = log || createLogger('CLI', opts);

  if (opts.test) {
    return runTest(opts, logger);
  }

  assertPath(basePath);
  if (opts.compileOnly) {
    return runCompile(opts, logger);
  }
  return runExecute(opts, logger);
};

export default parse;

// TODO probably this isn't neccessary and we just use cwd?
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

export const runExecute = async (options: SafeOpts, logger: Logger) => {
  const state = await loadState(options, logger);
  const code = await compile(options, logger);
  const result = await execute(code, state, options);
  
  if (options.outputStdout) {
    // TODO Log this even if in silent mode
    logger.success(`Result: `)
    logger.success(result)
  } else {
    if (!options.silent) {
      logger.success(`Writing output to ${options.outputPath}`)
    }
    await fs.writeFile(options.outputPath, JSON.stringify(result, null, 4));
  }

  logger.success(`Done! ✨`)
}

export const runCompile = async (options: SafeOpts, logger: Logger) => {
  const code = await compile(options, logger);
  if (options.outputStdout) {
    // Log this even if in silent mode
    logger.success('Compiled code:')
    console.log(code)
  } else {
    await fs.writeFile(options.outputPath, code);
    logger.success(`Compiled to ${options.outputPath}`)
  }
};

export const runTest = async (options: SafeOpts, logger: Logger) => {
  logger.log('Running test job...')

  // This is a bit weird but it'll actually work!
  options.jobPath = `const fn = () => state => state * 2; fn()`;

  if (!options.stateStdin) {
    logger.warn('No state detected: pass -S <number> to provide some state');
    options.stateStdin = "21";
  }
  
  const silentLogger = createNullLogger();

  const state = await loadState(options, silentLogger);
  const code = await compile(options, logger);
  logger.break()
  logger.info('Compiled job:', '\n', code) // TODO there's an ugly intend here
  logger.break()
  logger.info('Running job...')
  const result = await execute(code, state, options);
  logger.success(`Result: ${result}`);
  return result;
};

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