import { Opts } from './options';
import execute from './execute/handler';
import compile from './compile/handler';
import test from './test/handler';
import deploy from './deploy/handler';
import docgen from './docgen/handler';
import docs from './docs/handler';
import metadata from './metadata/handler';
import pull from './pull/handler';
import { clean, install, pwd, list } from './repo/handler';

import createLogger, { CLI, Logger, LogLevel } from './util/logger';
// import ensureOpts, { ensureLogOpts } from './util/ensure-opts';
import expandAdaptors from './util/expand-adaptors';
import mapAdaptorsToMonorepo, {
  MapAdaptorsToMonorepoOptions,
} from './util/map-adaptors-to-monorepo';
import printVersions from './util/print-versions';

export type CommandList =
  | 'compile'
  | 'deploy'
  | 'docgen'
  | 'docs'
  | 'execute'
  | 'metadata'
  | 'pull'
  | 'repo-clean'
  | 'repo-install'
  | 'repo-list'
  | 'repo-pwd'
  | 'test'
  | 'version';

const handlers = {
  execute,
  compile,
  test,
  deploy,
  docgen,
  docs,
  metadata,
  pull,
  ['repo-clean']: clean,
  ['repo-install']: install,
  ['repo-pwd']: pwd,
  ['repo-list']: list,
  version: async (opts: SafeOpts, logger: Logger) =>
    printVersions(logger, opts),
};

// TODO this type really doesn't make sense anymore either, since opts are typed to a particular command now
export type SafeOpts = Required<Omit<Opts, 'log' | 'adaptor' | 'statePath'>> & {
  log: Record<string, LogLevel>;
  adaptor: string | boolean;
  monorepoPath?: string;
  statePath?: string;
};

// const maybeEnsureOpts = (basePath: string, options: Opts) =>
//   // If the command is compile or execute, just return the opts (yargs will do all the validation)
//   /(^(deploy|execute|compile|test)$)|(repo-)/.test(options.command!)
//     ? ensureLogOpts(options)
//     : // Otherwise  older commands still need to go through ensure opts
//       ensureOpts(basePath, options);

// Top level command parser
const parse = async (basePath: string, options: SafeOpts, log?: Logger) => {
  const logger = log || createLogger(CLI, options);

  // In execute and test, always print version info FIRST
  // Should we ALwAYS just do this? It logs to info so you wouldn't usually see it on eg test, docs
  if (options.command === 'execute' || options.command === 'test') {
    await printVersions(logger, options);
  }

  if (options.monorepoPath) {
    if (options.monorepoPath === 'ERR') {
      logger.error(
        'ERROR: --use-adaptors-monorepo was passed, but OPENFN_ADAPTORS_REPO env var is undefined'
      );
      logger.error('Set OPENFN_ADAPTORS_REPO to a path pointing to the repo');
      process.exit(9); // invalid argument
    }
    await mapAdaptorsToMonorepo(
      options as MapAdaptorsToMonorepoOptions,
      logger
    );
  } else if (options.adaptors && options.expandAdaptors) {
    // TODO this will be removed once all options have been refactored
    //      This is safely redundant in execute and compile
    expandAdaptors(options);
  }

  // TODO do this in the repoDir option
  if (!/^(deploy|test|version)$/.test(options.command) && !options.repoDir) {
    logger.warn(
      'WARNING: no repo module dir found! Using the default (/tmp/repo)'
    );
    logger.warn(
      'You should set OPENFN_REPO_DIR or pass --repoDir=some/path in to the CLI'
    );
  }

  const handler = options.command ? handlers[options.command] : execute;
  if (!options.command || /^(compile|execute)$/.test(options.command)) {
    assertPath(basePath);
  }
  if (!handler) {
    logger.error(`Unrecognised command: ${options.command}`);
    process.exit(1);
  }

  try {
    // @ts-ignore types on SafeOpts are too contradictory for ts, see #115
    const result = await handler(options, logger);
    return result;
  } catch (e: any) {
    if (!process.exitCode) {
      process.exitCode = e.exitCode || 1;
    }
    if (e.handled) {
      // If throwing an epected error from util/abort, we do nothing
    } else {
      // This is unexpected error and we should try to log something
      logger.break();
      logger.error('Command failed!');
      logger.error(e);
    }
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
