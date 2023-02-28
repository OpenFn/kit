import { Opts } from './options';
import execute from './execute/handler';
import compile from './compile/handler';
import test from './test/handler';
import docgen from './docgen/handler';
import docs from './docs/handler';
import metadata from './metadata/handler';
import { clean, install, pwd, list } from './repo/handler';

import createLogger, { CLI, Logger, LogLevel } from './util/logger';
import ensureOpts, { ensureLogOpts } from './util/ensure-opts';
import expandAdaptors from './util/expand-adaptors';
import useAdaptorsRepo from './util/use-adaptors-repo';
import printVersions from './util/print-versions';

export type CommandList =
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

const handlers = {
  execute,
  compile,
  test,
  docgen,
  docs,
  metadata,
  ['repo-clean']: clean,
  ['repo-install']: install,
  ['repo-pwd']: pwd,
  ['repo-list']: list,
  version: async (opts: SafeOpts, logger: Logger) =>
    printVersions(logger, opts),
};

export type SafeOpts = Required<Omit<Opts, 'log' | 'adaptor' | 'statePath'>> & {
  log: Record<string, LogLevel>;
  adaptor: string | boolean;
  monorepoPath?: string;
  statePath?: string;
};

const maybeEnsureOpts = (basePath: string, options: Opts) =>
  // If the command is compile or execute, just return the opts (yargs will do all the validation)
  /^(execute|compile)$/.test(options.command!)
    ? ensureLogOpts(options)
    : // Otherwise  older commands still need to go through ensure opts
      ensureOpts(basePath, options);

// Top level command parser
const parse = async (basePath: string, options: Opts, log?: Logger) => {
  const opts = maybeEnsureOpts(basePath, options);
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
  } else if (opts.adaptors && opts.expandAdaptors) {
    // TODO this will be removed once all options have been refactored
    //      This is safely redundant in execute and compile
    opts.adaptors = expandAdaptors(opts.adaptors);
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
