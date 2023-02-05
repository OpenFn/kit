import createLogger, { CLI, Logger, LogLevel } from './util/logger';
import ensureOpts from './util/ensure-opts';
import execute from './execute/handler';
import compile from './compile/handler';
import test from './test/handler';
import docgen from './docgen/handler';
import docs from './docs/handler';
import { clean, install, pwd, list } from './repo/handler';
import expandAdaptors from './util/expand-adaptors';
import useAdaptorsRepo from './util/use-adaptors-repo';
import printVersions from './util/print-versions';

type CommandList =
  | 'execute'
  | 'compile'
  | 'repo-clean'
  | 'repo-install'
  | 'repo-install'
  | 'repo-pwd'
  | 'version'
  | 'docs'
  | 'docgen'
  | 'test';

export type Opts = {
  command?: CommandList;

  adaptor?: boolean | string;
  adaptors?: string[];
  useAdaptorsMonorepo?: string | boolean;
  autoinstall?: boolean;
  expand?: boolean; // for unit tests really
  force?: boolean;
  immutable?: boolean;
  jobPath?: string;
  log?: string[];
  logJson?: boolean;
  noCompile?: boolean;
  strictOutput?: boolean; // defaults to true
  outputPath?: string;
  outputStdout?: boolean;
  operation?: string;
  packages?: string[];
  specifier?: string; // docgen
  repoDir?: string;
  skipAdaptorValidation?: boolean;
  statePath?: string;
  stateStdin?: string;
  timeout?: number; // ms
};

const handlers = {
  execute,
  compile,
  test,
  docgen,
  docs,
  ['repo-clean']: clean,
  ['repo-install']: install,
  ['repo-pwd']: pwd,
  ['repo-list']: list,
  version: async (opts: SafeOpts, logger: Logger) =>
    printVersions(logger, opts),
};

export type SafeOpts = Required<Omit<Opts, 'log' | 'adaptor'>> & {
  log: Record<string, LogLevel>;
  adaptor: string | boolean;
  monorepoPath?: string;
};

// Top level command parser
const parse = async (basePath: string, options: Opts, log?: Logger) => {
  // const opts = ensureOpts(basePath, options);
  const logger = log || createLogger(CLI, opts);

  // In execute and test, always print version info FIRST
  // Should we ALwAYS just do this? It logs to info so you wouldn't usually see it on eg test, docs
  if (opts.command === 'execute' || opts.command === 'test') {
    await printVersions(logger, opts);
  }

  if (opts.monorepoPath) {
    if (opts.monorepoPath === 'ERR') {
      logger.error(
        'ERROR: --use-adaptors-monorepo was passed, but OPENFN_ADAPTORS_REPO env var is undefined'
      );
      logger.error('Set OPENFN_ADAPTORS_REPO to a path pointing to the repo');
      process.exit(9); // invalid argument
    }
    opts.adaptors = await useAdaptorsRepo(
      opts.adaptors,
      opts.monorepoPath,
      logger
    );
  } else if (opts.adaptors && opts.expand) {
    // Note that we can't do this in ensureOpts because we don't have a logger configured yet
    opts.adaptors = expandAdaptors(opts.adaptors, logger);
  }

  if (/^(test|version)$/.test(opts.command) && !opts.repoDir) {
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
    logger.error(`Unrecognised command: ${options.command}`);
    process.exit(1);
  }

  // tmp
  console.log(opts)
  return

  try {
    // @ts-ignore types on SafeOpts are too contradictory for ts, see #115
    const result = await handler(opts, logger);
    return result;
  } catch (e: any) {
    if (!process.exitCode) {
      process.exitCode = e.exitCode || 1;
    }
    logger.break();
    logger.error('Command failed!');
    logger.error(e);
  }
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
