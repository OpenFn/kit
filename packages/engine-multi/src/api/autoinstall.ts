// https://github.com/OpenFn/kit/issues/251

import {
  ExecutionPlan,
  ensureRepo,
  getAliasedName,
  getNameAndVersion,
  loadRepoPkg,
} from '@openfn/runtime';
import { install as runtimeInstall } from '@openfn/runtime';

import type { Logger } from '@openfn/logger';
import type { ExecutionContext } from '../types';
import { AUTOINSTALL_COMPLETE, AUTOINSTALL_ERROR } from '../events';
import { AutoinstallError } from '../errors';

// none of these options should be on the plan actually
export type AutoinstallOptions = {
  skipRepoValidation?: boolean;
  handleInstall?(fn: string, repoDir: string, logger: Logger): Promise<void>;
  handleIsInstalled?(
    fn: string,
    repoDir: string,
    logger: Logger
  ): Promise<boolean>;
};

const pending: Record<string, Promise<void>> = {};

const autoinstall = async (context: ExecutionContext): Promise<ModulePaths> => {
  const { logger, state, options } = context;
  const { plan } = state;
  const { repoDir, whitelist } = options;
  const autoinstallOptions = options.autoinstall || {};

  const installFn = autoinstallOptions?.handleInstall || install;
  const isInstalledFn = autoinstallOptions?.handleIsInstalled || isInstalled;

  let didValidateRepo = false;
  const { skipRepoValidation } = autoinstallOptions;

  if (!repoDir) {
    logger.warn('WARNING: skipping autoinstall because repoDir is not set');
    return {};
  }

  if (!skipRepoValidation && !didValidateRepo) {
    // TODO what if this throws?
    // Whole server probably needs to crash, so throwing is probably appropriate
    await ensureRepo(repoDir, logger);
    didValidateRepo = true;
  }

  const adaptors = Array.from(identifyAdaptors(plan));
  // TODO would rather do all this in parallel but this is fine for now
  // TODO set iteration is weirdly difficult?
  const paths: ModulePaths = {};

  for (const a of adaptors) {
    // Ensure that this is not blacklisted
    // TODO what if it is? For now we'll log and skip it
    if (whitelist && !whitelist.find((r) => r.exec(a))) {
      logger.warn('WARNING: autoinstall skipping blacklisted module ', a);
      continue;
    }

    // Return a path name to this module for the linker to use later
    // TODO this is all a bit rushed
    const alias = getAliasedName(a);
    const { name, version } = getNameAndVersion(a);
    paths[name] = { path: `${repoDir}/node_modules/${alias}` };

    const needsInstalling = !(await isInstalledFn(a, repoDir, logger));
    if (needsInstalling) {
      if (!pending[a]) {
        const startTime = Date.now();
        pending[a] = installFn(a, repoDir, logger)
          .then(() => {
            const duration = Date.now() - startTime;

            logger.success(`autoinstalled ${a} in ${duration / 1000}s`);
            context.emit(AUTOINSTALL_COMPLETE, {
              module: name,
              version: version!,
              duration,
            });
            delete pending[a];
          })
          .catch((e: any) => {
            delete pending[a];

            logger.error(`ERROR autoinstalling ${a}: ${e.message}`);
            logger.error(e);
            const duration = Date.now() - startTime;
            context.emit(AUTOINSTALL_ERROR, {
              module: name,
              version: version!,
              duration,
              message: e.message || e.toString(),
            });

            // wrap and re-throw the error
            throw new AutoinstallError(a, e);
          });
      } else {
        logger.info(
          `autoinstall waiting for previous promise for ${a} to resolve...`
        );
      }
      // Return the pending promise (safe to do this multiple times)
      // TODO if this is a chained promise, emit something like "using cache for ${name}"
      await pending[a].then();
    }
  }
  return paths;
};

export default autoinstall;

// The actual install function is not unit tested
// It's basically just a proxy to @openfn/runtime
const install = (specifier: string, repoDir: string, logger: Logger) =>
  runtimeInstall(specifier, repoDir, logger);

// The actual isInstalled function is not unit tested
// TODO this should probably all be handled (and tested) in @openfn/runtime
const isInstalled = async (
  specifier: string,
  repoDir: string,
  logger: Logger
) => {
  const alias = getAliasedName(specifier);
  if (!alias.match('_')) {
    // Note that if the adaptor has no version number, the alias will be "wrong"
    // and we will count the adaptor as uninstalled
    // The install function will later decide a version number and may, or may
    // not, install for us.
    // This log isn't terrible helpful as there's no attempt version info
    logger.warn(
      `adaptor ${specifier} does not have a version number - will attempt to auto-install`
    );
  }
  // TODO is it really appropriate to load this file each time?
  const pkg = await loadRepoPkg(repoDir);
  if (pkg) {
    const { dependencies } = pkg;
    return dependencies.hasOwnProperty(alias);
  }
};

export const identifyAdaptors = (plan: ExecutionPlan): Set<string> => {
  const adaptors = new Set<string>();
  plan.jobs
    .filter((job) => job.adaptor)
    .forEach((job) => adaptors.add(job.adaptor!));
  return adaptors;
};

export type ModulePaths = Record<string, { path: string }>;
