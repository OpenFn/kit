import type { ExecuteOptions } from './command';
import execute from './execute';
import serializeOutput from './serialize-output';
import getAutoinstallTargets from './get-autoinstall-targets';

import { install } from '../repo/handler';
import compile from '../compile/compile';
import { CompileOptions } from '../compile/command';

import { Logger, printDuration } from '../util/logger';
import loadState from '../util/load-state';
import validateAdaptors from '../util/validate-adaptors';
import loadInput from '../util/load-input';
import expandAdaptors from '../util/expand-adaptors';
import mapAdaptorsToMonorepo, {
  MapAdaptorsToMonorepoOptions,
} from '../util/map-adaptors-to-monorepo';
import assertPath from '../util/assert-path';

const executeHandler = async (options: ExecuteOptions, logger: Logger) => {
  const start = new Date().getTime();
  assertPath(options.path);
  await validateAdaptors(options, logger);

  let input = await loadInput(options, logger);

  if (options.workflow) {
    // expand shorthand adaptors in the workflow jobs
    expandAdaptors(options);
    await mapAdaptorsToMonorepo(
      options as MapAdaptorsToMonorepoOptions,
      logger
    );
  }

  const { repoDir, monorepoPath, autoinstall } = options;
  if (autoinstall) {
    if (monorepoPath) {
      logger.warn('Skipping auto-install as monorepo is being used');
    } else {
      const autoInstallTargets = getAutoinstallTargets(options);
      if (autoInstallTargets.length) {
        logger.info('Auto-installing language adaptors');
        await install({ packages: autoInstallTargets, repoDir }, logger);
      }
    }
  }

  const state = await loadState(options, logger);

  if (options.compile) {
    input = await compile(options as CompileOptions, logger);
  } else {
    logger.info('Skipping compilation as noCompile is set');
  }

  try {
    const result = await execute(input!, state, options);
    await serializeOutput(options, result, logger);
    const duration = printDuration(new Date().getTime() - start);
    if (result?.errors) {
      logger.warn(
        `Errors reported in ${Object.keys(result.errors).length} jobs`
      );
    }
    logger.success(`Finished in ${duration}${result?.errors ? '' : ' ✨'}`);
    return result;
  } catch (err: any) {
    if (!err.handled) {
      logger.error('Unexpected error in execution');
      logger.error(err);
    }
    const duration = printDuration(new Date().getTime() - start);
    logger.always(`Workflow failed in ${duration}.`);
    process.exitCode = 1;
  }
};

export default executeHandler;
