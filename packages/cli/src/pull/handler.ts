import path from 'path';
import fs from 'node:fs/promises';
import {
  DeployConfig,
  getProject,
  getConfig,
  getState ,
} from '@openfn/deploy';
import type { Logger } from '../util/logger';
import { DeployOptions } from '../deploy/command';



async function pullHandler(
  options: DeployOptions,
  logger: Logger,
) {
  try {
    const config = mergeOverrides(await getConfig(options.configPath), options);
    logger.always("Downloading project yaml and  state from instance");
    const state = await getState(config.statePath);
    const { data: new_state } = await getProject(config, state.id);
    const url = new URL(`/download/yaml?id=${state.id}`, config.endpoint);
    const res = await fetch(url);
    await fs.writeFile(path.resolve(config.specPath), res.body);
    await fs.writeFile(path.resolve(config.statePath), new_state);
    logger.success("Project pulled successfully");
    process.exitCode = 0;
    return true; 
  } catch (error: any) {
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
    configPath: options.configPath,
    requireConfirmation: pickFirst(options.confirm, config.requireConfirmation),
  };
}

function pickFirst<T>(...args: (T | null | undefined)[]): T {
  return args.find((arg) => arg !== undefined && arg !== null) as T;
}

export default pullHandler;
