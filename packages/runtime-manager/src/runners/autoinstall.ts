// https://github.com/OpenFn/kit/issues/251

import {
  ExecutionPlan,
  ensureRepo,
  getAliasedName,
  loadRepoPkg,
} from '@openfn/runtime';
import { install } from '@openfn/runtime';
import type { Logger } from '@openfn/logger';

// The actual install function is not unit tested
// It's basically just a proxy to @openfn/runtime
const doHandleInstall = (specifier: string, options: Options) =>
  install(specifier, options.repoDir, options.logger);

// The actual isInstalled function is not unit tested
// TODO this should probably all be handled (and tested) in @openfn/runtime
const doIsInstalled = async (specifier: string, options: Options) => {
  const alias = getAliasedName(specifier);
  if (!alias.match('_')) {
    // Note that if the adaptor has no version number, the alias will be "wrong"
    // and we will count the adaptor as uninstalled
    // The install function will later decide a version number and may, or may
    // not, install for us.
    // This log isn't terrible helpful as there's no attempt version info
    options.logger.warn(
      `adaptor ${specifier} does not have a version number - will attempt to auto-install`
    );
  }
  // TODO is it really appropriate to load this file each time?
  const pkg = await loadRepoPkg(options.repoDir);
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

type Options = {
  repoDir: string;
  logger: Logger;
  handleInstall?(
    fn: string,
    options?: Pick<Options, 'repoDir' | 'logger'>
  ): Promise<void>;
  handleIsInstalled?(
    fn: string,
    options?: Pick<Options, 'repoDir' | 'logger'>
  ): Promise<boolean>;
};

const createAutoInstall = (options: Options) => {
  const install = options.handleInstall || doHandleInstall;
  const isInstalled = options.handleIsInstalled || doIsInstalled;
  const pending: Record<string, Promise<void>> = {};

  let didValidateRepo = false;

  return async (plan: ExecutionPlan): Promise<void> => {
    if (!didValidateRepo && options.repoDir) {
      // TODO what if this throws?
      // Whole server probably needs to crash, so throwing is probably appropriate
      await ensureRepo(options.repoDir, options.logger);
      didValidateRepo = true;
    }

    const adaptors = identifyAdaptors(plan);
    // TODO would rather do all this in parallel but this is fine for now
    // TODO set iteration is weirdly difficult?
    for (const a of Array.from(adaptors)) {
      const needsInstalling = !(await isInstalled(a, options));
      if (needsInstalling) {
        if (!pending[a]) {
          // add a promise to the pending array
          pending[a] = install(a, options);
        }
        // Return the pending promise (safe to do this multiple times)
        await pending[a].then();
      }
    }
  };
};

export default createAutoInstall;
