import {
  DeployConfig,
  DeployError,
  deploy,
  getConfig,
  validateConfig,
} from '@openfn/deploy';
import type { Logger } from '../util/logger';
import { DeployOptions } from './command';
import * as beta from '../projects/deploy';
import path from 'node:path';
import { fileExists } from '../util/file-exists';
import Project, { detectVersion, yamlToJson } from '@openfn/project';
import fs from 'node:fs/promises';

export type DeployFn = typeof deploy;
export type BetaHandlerFn = typeof beta.handler;

const actualDeploy: DeployFn = deploy;
const actualBetaHandler: BetaHandlerFn = beta.handler;

// Flexible `deployFn` / `betaHandler` interfaces for testing.
async function deployHandler<F extends (...args: any) => any>(
  options: DeployOptions,
  logger: Logger,
  deployFn: F,
  betaHandler?: BetaHandlerFn
): Promise<ReturnType<typeof deployFn>>;

async function deployHandler(
  options: DeployOptions,
  logger: Logger,
  deployFn = actualDeploy,
  betaHandler: BetaHandlerFn = actualBetaHandler
) {
  if (options.beta) {
    return betaHandler(options as any, logger);
  }

  try {
    const config = mergeOverrides(await getConfig(options.configPath), options);

    const v2ConfigPath = path.join(
      options.workspace || process.cwd(),
      'openfn.yaml'
    );
    if (!process.env.PREFER_LEGACY_SYNC && (await fileExists(v2ConfigPath))) {
      return redirectTov2(v2ConfigPath, options, config, logger, betaHandler);
    }

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

    const rawSpec = await fs.readFile(config.specPath, 'utf-8');
    const convertedSpec = await maybeConvertV2spec(rawSpec);
    if (convertedSpec !== rawSpec) {
      logger.info(
        'Detected v2 spec file - converting to legacy format; validation will be skipped.'
      );
      config.spec = convertedSpec;
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
  const workspace = options.workspace || process.cwd();
  const resolveRelative = (p: string) =>
    path.isAbsolute(p) ? p : path.join(workspace, p);
  const specPath = pickFirst(options.projectPath, config.specPath);
  const statePath = pickFirst(options.statePath, config.statePath);
  return {
    ...config,
    apiKey: pickFirst(process.env['OPENFN_API_KEY'], config.apiKey),
    endpoint: pickFirst(process.env['OPENFN_ENDPOINT'], config.endpoint),
    statePath: resolveRelative(statePath),
    specPath: resolveRelative(specPath),
    configPath: resolveRelative(options.configPath),
    requireConfirmation: pickFirst(options.confirm, config.requireConfirmation),
  };
}

function pickFirst<T>(...args: (T | null | undefined)[]): T {
  return args.find((arg) => arg !== undefined && arg !== null) as T;
}

const redirectTov2 = async (
  v2ConfigPath: string,
  options: DeployOptions,
  config: DeployConfig,
  logger: Logger,
  betaHandler: BetaHandlerFn = actualBetaHandler
) => {
  logger.always(
    'Detected openfn.yaml file - switching to v2 deploy (openfn project deploy). Set PREFER_LEGACY_SYNC to disable this.'
  );

  // default endpoint to one from openfn.yaml
  const v2config = yamlToJson(await fs.readFile(v2ConfigPath, 'utf-8'));
  const endpoint =
    options.endpoint ?? v2config?.project?.endpoint ?? config.endpoint;

  return betaHandler(
    {
      ...options,
      force: true,
      endpoint,
      apiKey: options.apiKey ?? config.apiKey ?? undefined,
    },
    logger
  );
};

export const maybeConvertV2spec = async (yaml: string): Promise<string> => {
  const json = yamlToJson(yaml) as any;
  if (detectVersion(json) > 1) {
    const project = await Project.from('project', json);
    return project.serialize('state', { format: 'yaml' }) as string;
  }
  return yaml;
};

export default deployHandler;
