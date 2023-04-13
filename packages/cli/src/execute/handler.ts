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

const executeHandler = async (options: ExecuteOptions, logger: Logger) => {
  const start = new Date().getTime();

  await validateAdaptors(options, logger);

  let input = await loadInput(options, logger);

  if (options.workflow) {
    // expand shorthand adaptors in the workflow jobs
    expandAdaptors(options);
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
    logger.success(`Done in ${duration}! ✨`);
    return result;
  } catch (error) {
    logger.error(error);

    const duration = printDuration(new Date().getTime() - start);
    logger.error(`Took ${duration}.`);
    process.exitCode = 1;
  }
};

export default executeHandler;
