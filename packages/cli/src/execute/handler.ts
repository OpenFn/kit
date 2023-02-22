import { readFile } from 'node:fs/promises';
import { Logger, printDuration } from '../util/logger';
import loadState from './load-state';
import execute from './execute';
import compile from '../compile/compile';
import serializeOutput from './serialize-output';
import { install } from '../repo/handler';
import type { ExecuteOptions } from './command';
import validateAdaptors from '../util/validate-adaptors';
import { CompileOptions } from '../compile/command';

export const getAutoinstallTargets = (
  options: Pick<ExecuteOptions, 'adaptors' | 'autoinstall'>
) => {
  if (options.adaptors) {
    return options.adaptors?.filter((a) => !/=/.test(a));
  }
  return [];
};

const executeHandler = async (options: ExecuteOptions, logger: Logger) => {
  const start = new Date().getTime();

  await validateAdaptors(options, logger);

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
  let code = '';
  if (options.compile) {
    code = await compile(options as CompileOptions, logger);
  } else {
    logger.info('Skipping compilation as noCompile is set');
    if (options.jobPath) {
      code = await readFile(options.jobPath, 'utf8');
      logger.success(`Loaded job from ${options.jobPath} (no compilation)`);
    }
  }

  try {
    const result = await execute(code, state, options);
    await serializeOutput(options, result, logger);
    const duration = printDuration(new Date().getTime() - start);
    logger.success(`Done in ${duration}! ✨`);
  } catch (error) {
    logger.error(error);

    const duration = printDuration(new Date().getTime() - start);
    logger.error(`Took ${duration}.`);
    process.exitCode = 1;
  }
};

export default executeHandler;
