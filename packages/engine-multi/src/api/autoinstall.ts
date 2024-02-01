import {
  ExecutionPlan,
  ensureRepo,
  getAliasedName,
  getNameAndVersion,
  loadRepoPkg,
} from '@openfn/runtime';
import { install as runtimeInstall } from '@openfn/runtime';

import { AUTOINSTALL_COMPLETE, AUTOINSTALL_ERROR } from '../events';
import { AutoinstallError } from '../errors';

import type { Logger } from '@openfn/logger';
import type { ExecutionContext } from '../types';

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

let busy = false;

const queue: Array<{ adaptors: string[]; callback: (err?: any) => void }> = [];

const enqueue = (adaptors: string[]) =>
  new Promise((resolve) => {
    queue.push({ adaptors, callback: resolve });
  });

// Install any modules for an Execution Plan that are not already installed
// This will enforce a queue ensuring only one module is installed at a time
// This fixes https://github.com/OpenFn/kit/issues/503
const autoinstall = async (context: ExecutionContext): Promise<ModulePaths> => {
  // TODO not a huge fan of these functions in the closure, but it's ok for now
  const processQueue = async () => {
    const next = queue.shift();
    if (next) {
      busy = true;
      const { adaptors, callback } = next;
      await doAutoinstall(adaptors, callback);
      processQueue();
    } else {
      // do nothing
      busy = false;
    }
  };

  // This will actually do the autoinstall for an run (all adaptors)
  const doAutoinstall = async (
    adaptors: string[],
    onComplete: (err?: any) => void
  ) => {
    // Check whether we still need to do any work
    for (const a of adaptors) {
      const { name, version } = getNameAndVersion(a);
      if (await isInstalledFn(a, repoDir, logger)) {
        continue;
      }

      const startTime = Date.now();
      try {
        await installFn(a, repoDir, logger);

        const duration = Date.now() - startTime;
        logger.success(`autoinstalled ${a} in ${duration / 1000}s`);
        context.emit(AUTOINSTALL_COMPLETE, {
          module: name,
          version: version!,
          duration,
        });
      } catch (e: any) {
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

        // Abort on the first error
        return onComplete(new AutoinstallError(a, e));
      }
    }
    onComplete();
  };

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
    // TODO do we need to do it on EVERY call? Can we not cache it?
    await ensureRepo(repoDir, logger);
    didValidateRepo = true;
  }

  const adaptors = Array.from(identifyAdaptors(plan));
  const paths: ModulePaths = {};

  const adaptorsToLoad = [];
  for (const a of adaptors) {
    // Ensure that this is not blacklisted
    if (whitelist && !whitelist.find((r) => r.exec(a))) {
      // TODO what if it is? For now we'll log and skip it
      // TODO actually we should throw a security error in this case
      logger.warn('WARNING: autoinstall skipping blacklisted module ', a);
      continue;
    }

    const alias = getAliasedName(a);
    const { name, version } = getNameAndVersion(a);

    const v = version || 'unknown';

    // Write the adaptor version to the context
    // This is a reasonably accurate, but not totally bulletproof, report
    context.versions[name] = v;

    paths[name] = {
      path: `${repoDir}/node_modules/${alias}`,
      version: v,
    };

    if (!(await isInstalledFn(a, repoDir, logger))) {
      adaptorsToLoad.push(a);
    }
  }

  if (adaptorsToLoad.length) {
    // Add this to the queue
    const p = enqueue(adaptorsToLoad);

    if (!busy) {
      processQueue();
    }

    return p.then((err) => {
      if (err) {
        throw err;
      }
      return paths;
    });
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
    // This log isn't terrible helpful as there's no run version info
    logger.warn(
      `adaptor ${specifier} does not have a version number - will try to auto-install`
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

export type ModulePaths = Record<string, { path: string; version: string }>;
