import path from 'path';
import fs from 'node:fs/promises';
import { DeployConfig, getConfig, getState, mergeProjectPayloadIntoState, getProject } from '@openfn/deploy';
import type { Logger } from '../util/logger';
import { PullOptions } from '../pull/command';
import assertPath from '../util/assert-path';


async function pullHandler(options:  PullOptions, logger: Logger) {
  try {
    assertPath(options.projectId);
    const config = mergeOverrides(await getConfig(options.configPath), options);
    logger.always('Downloading project yaml and  state from instance');

    const state = await getState(config.statePath);
    const url = new URL(`/download/yaml?id=${options.projectId}`, config.endpoint);
    const res = await fetch(url);

    // @ts-ignore
    await fs.writeFile(path.resolve(config.specPath), res.body);

    const { data: currentProject } = await getProject(config, options.projectId);
    const nextState = mergeProjectPayloadIntoState(state, currentProject)

    // @ts-ignore
    await fs.writeFile(path.resolve(config.statePath), JSON.stringify(nextState));

    logger.success('Project pulled successfully');
    process.exitCode = 0;
    return true;
  } catch (error: any) {
    throw error;
  }
}

// Priority of Merging
// Config
// Env vars
// Options
function mergeOverrides(
  config: DeployConfig,
  options: PullOptions
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
