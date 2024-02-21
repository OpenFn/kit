import { Opts } from './options';
import execute from './execute/handler';
import compile from './compile/handler';
import test from './test/handler';
import deploy from './deploy/handler';
import docgen from './docgen/handler';
import docs from './docs/handler';
import generateAdaptor from './generate/adaptor';
import metadata from './metadata/handler';
import pull from './pull/handler';
import { clean, install, pwd, list } from './repo/handler';

import createLogger, { CLI, Logger } from './util/logger';
import mapAdaptorsToMonorepo, {
  validateMonoRepo,
} from './util/map-adaptors-to-monorepo';
import printVersions from './util/print-versions';

export type CommandList =
  | 'compile'
  | 'deploy'
  | 'docgen'
  | 'docs'
  | 'execute'
  | 'generate-adaptor'
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
  ['generate-adaptor']: generateAdaptor,
  metadata,
  pull,
  ['repo-clean']: clean,
  ['repo-install']: install,
  ['repo-pwd']: pwd,
  ['repo-list']: list,
  version: async (opts: Opts, logger: Logger) =>
    printVersions(logger, opts, true),
};

// Top level command parser
const parse = async (options: Opts, log?: Logger) => {
  const logger = log || createLogger(CLI, options);

  // In execute and test, always print version info FIRST
  // Should we ALwAYS just do this? It logs to info so you wouldn't usually see it on eg test, docs
  if (options.command === 'execute' || options.command === 'test') {
    await printVersions(logger, options);
  }

  const { monorepoPath } = options;
  if (monorepoPath) {
    // TODO how does this occur?
    if (monorepoPath === 'ERR') {
      logger.error(
        'ERROR: --use-adaptors-monorepo was passed, but OPENFN_ADAPTORS_REPO env var is undefined'
      );
      logger.error('Set OPENFN_ADAPTORS_REPO to a path pointing to the repo');
      process.exit(9); // invalid argument
    }

    await validateMonoRepo(monorepoPath, logger);
    logger.success(`Loading adaptors from monorepo at ${monorepoPath}`);

    options.adaptors = mapAdaptorsToMonorepo(
      monorepoPath,
      options.adaptors,
      logger
    ) as string[];
  }

  // TODO it would be nice to do this in the repoDir option, but
  // the logger isn't available yet
  if (
    !/^(pull|deploy|test|version|generate-adaptor)$/.test(options.command!) &&
    !options.repoDir
  ) {
    logger.warn(
      'WARNING: no repo module dir found! Using the default (/tmp/repo)'
    );
    logger.warn(
      'You should set OPENFN_REPO_DIR or pass --repoDir=some/path in to the CLI'
    );
  }

  const handler = handlers[options.command!];

  if (!handler) {
    logger.error(`Unrecognised command: ${options.command}`);
    process.exit(1);
  }

  try {
    // TODO tighten up the typings on this signature
    // @ts-ignore
    return await handler(options, logger);
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
