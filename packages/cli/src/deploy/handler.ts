import { DeployError, deploy, getConfig, validateConfig } from '@openfn/deploy';
import type { Logger } from '../util/logger';
import { DeployOptions } from './command';

export type DeployFn = typeof deploy;

const actualDeploy: DeployFn = deploy;

// Flexible `deployFn` interface for testing.
async function deployHandler<F extends (...args: any) => any>(
  options: DeployOptions,
  logger: Logger,
  deployFn: F
): Promise<ReturnType<typeof deployFn>>;

async function deployHandler(
  options: DeployOptions,
  logger: Logger,
  deployFn = actualDeploy
) {
  try {
    logger.debug('Deploying with options', JSON.stringify(options, null, 2));
    const config = await getConfig(options.configPath);

    if (options.confirm === false) {
      config.requireConfirmation = options.confirm;
    }

    if (process.env['OPENFN_API_KEY']) {
      logger.info('Using OPENFN_API_KEY environment variable');
      config.apiKey = process.env['OPENFN_API_KEY'];
    }

    if (process.env['OPENFN_ENDPOINT']) {
      logger.info('Using OPENFN_ENDPOINT environment variable');
      config.endpoint = process.env['OPENFN_ENDPOINT'];
    }

    logger.debug('Deploying with config', config);
    logger.info(`Deploying`);

    validateConfig(config);

    const isOk = await deployFn(config, logger);
    if (isOk) {
      process.exitCode = 0;
      logger.info(`Deployed`);
      return isOk;
    } else {
      process.exitCode = 1;
      return isOk;
    }
  } catch (error: any) {
    if (error instanceof DeployError) {
      logger.error(error.message);
      process.exitCode = 10;
      return false;
    }

    throw error;
  }
}

export default deployHandler;
