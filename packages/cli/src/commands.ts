import createLogger, { CLI, Logger, LogLevel } from './util/logger';
import ensureOpts from './util/ensure-opts';
import execute from './execute/handler';
import compile from './compile/handler';
import test from './test/handler';
import docgen from './docgen/handler';
import { clean, install, pwd, list } from './repo/handler';
import expandAdaptors from './util/expand-adaptors';

export type Opts = {
  command?: string;

  adaptor?: boolean;
  adaptors?: string[];
  autoinstall?: boolean;
  immutable?: boolean;
  jobPath?: string;
  expand: boolean; // for unit tests really
  force?: boolean;
  log?: string[];
  repoDir?: string;
  noCompile?: boolean;
  outputPath?: string;
  outputStdout?: boolean;
  packages?: string[];
  specifier?: string; // docgen
  statePath?: string;
  stateStdin?: string;
};

const handlers = {
  execute,
  compile,
  test,
  docgen,
  ['repo-clean']: clean,
  ['repo-install']: install,
  ['repo-pwd']: pwd,
  ['repo-list']: list,
};

export type SafeOpts = Required<Omit<Opts, 'log'>> & {
  log: Record<string, LogLevel>;
};

// Top level command parser
const parse = async (basePath: string, options: Opts, log?: Logger) => {
  const opts = ensureOpts(basePath, options);
  const logger = log || createLogger(CLI, opts);

  if (opts.adaptors && opts.expand) {
    // Note that we can't do this in ensureOpts because we don't have a logger configured yet
    opts.adaptors = expandAdaptors(opts.adaptors, logger);
  }

  if (opts.command! == 'test' && !opts.repoDir) {
    logger.warn(
      'WARNING: no repo module dir found! Using the default (/tmp/repo)'
    );
    logger.warn(
      'You should set OPENFN_REPO_DIR or pass --repoDir=some/path in to the CLI'
    );
  }

  const handler = options.command ? handlers[options.command] : execute;
  if (!opts.command || /^(compile|execute)$/.test(opts.command)) {
    assertPath(basePath);
  }
  if (!handler) {
    logger.error(`Unrecognise command: ${options.command}`);
    process.exit(1);
  }

  return handler(opts, logger);
};

export default parse;

// TODO probably this isn't neccessary and we just use cwd?
const assertPath = (basePath?: string) => {
  if (!basePath) {
    console.error('ERROR: no path provided!');
    console.error('\nUsage:');
    console.error('  open path/to/job');
    console.error('\nFor more help do:');
    console.error('  openfn --help ');
    process.exit(1);
  }
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
