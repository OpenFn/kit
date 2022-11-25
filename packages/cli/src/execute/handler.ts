import { Logger, printDuration } from '../util/logger';
import loadState from './load-state';
import execute from './execute';
import compile from '../compile/compile';
import serializeOutput from './serialize-output';
import { install } from '../repo/handler';
import { SafeOpts } from '../commands';

const executeHandler = async (options: SafeOpts, logger: Logger) => {
  const start = new Date().getTime();

  // auto install the language adaptor
  if (options.autoinstall) {
    const { repoDir } = options;
    logger.info('Auto-installing language adaptors');
    await install({ packages: options.adaptors, repoDir }, logger);
  }

  const state = await loadState(options, logger);
  const code = await compile(options, logger);
  const result = await execute(code, state, options);

  await serializeOutput(options, result, logger);

  const duration = printDuration(new Date().getTime() - start);
  logger.success(`Done in ${duration}! ✨`);
};

export default executeHandler;
