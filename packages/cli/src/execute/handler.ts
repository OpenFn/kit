import { Logger, printDuration } from '../util/logger';
import printVersions from '../util/print-versions';
import loadState from './load-state';
import execute from './execute';
import compile from '../compile/compile';
import serializeOutput from './serialize-output';
import { install } from '../repo/handler';
import { Opts, SafeOpts } from '../commands';

export const getAutoinstallTargets = (
  options: Pick<Opts, 'adaptors' | 'autoinstall'>
) => {
  if (options.autoinstall && options.adaptors) {
    return options.adaptors?.filter((a) => !/=/.test(a));
  }
  return [];
};

const executeHandler = async (options: SafeOpts, logger: Logger) => {
  await printVersions(logger);

  const start = new Date().getTime();

  const autoInstallTargets = getAutoinstallTargets(options);
  if (autoInstallTargets.length) {
    const { repoDir } = options;
    logger.info('Auto-installing language adaptors');
    await install({ packages: autoInstallTargets, repoDir }, logger);
  }

  const state = await loadState(options, logger);
  const code = await compile(options, logger);
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
