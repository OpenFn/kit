import { Opts } from './options';
import apollo from './apollo/handler';
import execute from './execute/handler';
import compile from './compile/handler';
import collections from './collections/handler';
import test from './test/handler';
import deploy from './deploy/handler';
import docgen from './docgen/handler';
import docs from './docs/handler';
import metadata from './metadata/handler';
import pull from './pull/handler';
import * as projects from './projects/handler';
import * as repo from './repo/handler';

import createLogger, { CLI, Logger } from './util/logger';
import mapAdaptorsToMonorepo, {
  validateMonoRepo,
} from './util/map-adaptors-to-monorepo';
import printVersions from './util/print-versions';
import abort from './util/abort';
import { report } from './env';

export type CommandList =
  | 'apollo'
  | 'compile'
  | 'collections-get'
  | 'collections-set'
  | 'collections-remove'
  | 'deploy'
  | 'docgen'
  | 'docs'
  | 'execute'
  | 'metadata'
  | 'pull'
  | 'projects'
  | 'project'
  | 'repo-clean'
  | 'repo-install'
  | 'repo-list'
  | 'repo-pwd'
  | 'project-list'
  | 'project-version'
  | 'project-merge'
  | 'project-checkout'
  | 'test'
  | 'version';

const handlers = {
  apollo,
  execute,
  compile,
  test,
  deploy,
  docgen,
  docs,
  metadata,
  pull,
  projects,
  ['collections-get']: collections.get,
  ['collections-set']: collections.set,
  ['collections-remove']: collections.remove,
  ['repo-clean']: repo.clean,
  ['repo-install']: repo.install,
  ['repo-pwd']: repo.pwd,
  ['repo-list']: repo.list,
  ['project-list']: projects.list,
  ['project-version']: projects.version,
  ['project-merge']: projects.merge,
  ['project-checkout']: projects.checkout,
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

  // Tell the user whether we're using env vars
  report(logger);

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
      // If throwing an expected error from util/abort, we do nothing
    } else if (e.abort) {
      try {
        // Run the abort code but catch the error
        abort(logger, e.reason, e.error, e.help);
      } catch (e) {}
    } else {
      // This is unexpected error and we should try to log something
      logger.break();
      logger.error('Command failed!');
      logger.error(e);
    }
  }
};

export default parse;
