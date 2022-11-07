import { exec } from 'node:child_process';
import treeify from 'treeify';
import { install as rtInstall, loadRepoPkg } from '@openfn/runtime';
import type { Opts, SafeOpts } from '../commands';
import { defaultLogger, Logger } from '../util/logger';
import expandAdaptors from '../util/expand-adaptors';

// Weird declaration of the possible values for the install API
type InstallOpts = Partial<Pick<Opts, 'packages' | 'adaptor' | 'repoDir'>>;

export const install = async (
  opts: InstallOpts,
  log: Logger = defaultLogger
) => {
  log.timer('install');
  let { packages, adaptor, repoDir } = opts;
  log.success('Installing packages...'); // not really success but I want it to default
  if (packages) {
    log.debug('repoDir is set to:', repoDir);
    if (adaptor) {
      packages = expandAdaptors(packages, log);
    }
    await rtInstall(packages, repoDir, log);
  }
  const duration = log.timer('install');
  log.success(`Installation complete in ${duration}`);
};

export const clean = async (options: SafeOpts, logger: Logger) => {
  if (options.repoDir) {
    const doIt = await logger.confirm(
      `This will remove everything at ${options.repoDir}. Do you wish to proceed?`,
      options.force
    );
    if (doIt) {
      return new Promise<void>((resolve) => {
        logger.info(`Cleaning repo at ${options.repoDir} `);
        exec(`npm exec rimraf ${options.repoDir}`, () => {
          logger.success('Repo cleaned');
          resolve();
        });
      });
    }
  } else {
    logger.error('Clean failed');
    logger.error('No repoDir path detected');
  }
};

export const pwd = async (options: SafeOpts, logger: Logger) => {
  // TODO should we report if modules home is set?
  logger.info(`OPENFN_REPO_DIR is set to ${process.env.OPENFN_REPO_DIR}`);
  logger.success(`Repo working directory is: ${options.repoDir}`);
};

export const getDependencyList = async (options: SafeOpts, _logger: Logger) => {
  const pkg = await loadRepoPkg(options.repoDir);

  const result: Record<string, string[]> = {};
  Object.keys(pkg.dependencies).forEach((key) => {
    const [name, version] = key.split('_');
    if (!result[name]) {
      result[name] = [];
    }
    result[name].push(version);
  });

  return result;
};
export const list = async (options: SafeOpts, logger: Logger) => {
  const tree = await getDependencyList(options, logger);
  await pwd(options, logger);

  // Convert the raw dependency list in a nice format for treeify
  const output: Record<string, any> = {};
  Object.keys(tree).forEach((key) => {
    const versions = tree[key];
    output[key] = {};
    versions.forEach((v) => {
      output[key][v] = null;
    });
  });

  // Print with treeify (not very good really)
  logger.success('Installed packages:\n\n' + treeify.asTree(output));
};
