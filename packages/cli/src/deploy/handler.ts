import {
  DeployConfig,
  DeployError,
  deploy,
  getConfig,
  validateConfig,
} from '@openfn/deploy';
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
    const config = mergeOverrides(await getConfig(options.configPath), options);

    logger.debug('Deploying with config', JSON.stringify(config, null, 2));

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

    process.exitCode = isOk ? 0 : 1;
    return isOk;
  } catch (error: any) {
    if (error instanceof DeployError) {
      logger.error(error.message);
      process.exitCode = 10;
      return false;
    }

    throw error;
  }
}

// Priority
// Config
// Env vars
// Options
function mergeOverrides(
  config: DeployConfig,
  options: DeployOptions
): DeployConfig {
  return {
    ...config,
    apiKey: pickFirst(process.env['OPENFN_API_KEY'], config.apiKey),
    endpoint: pickFirst(process.env['OPENFN_ENDPOINT'], config.endpoint),
    statePath: pickFirst(options.statePath, config.statePath),
    configPath: options.configPath,
    requireConfirmation: pickFirst(options.confirm, config.requireConfirmation),
  };
}

function pickFirst<T>(...args: (T | null | undefined)[]): T {
  return args.find((arg) => arg !== undefined && arg !== null) as T;
}

export default deployHandler;
