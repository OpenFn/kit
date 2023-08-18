import path from 'path';
import fs from 'node:fs/promises';
import {
  DeployConfig,
  getConfig,
  getState,
  mergeSpecIntoState,
  getSpec,
} from '@openfn/deploy';
import type { Logger } from '../util/logger';
import { PullOptions } from '../pull/command';
import assertPath from '../util/assert-path';

async function pullHandler(options: PullOptions, logger: Logger) {
  try {
    assertPath(options.projectId);
    const config = mergeOverrides(await getConfig(options.configPath), options);
    logger.always('Downloading project yaml and state from instance');

    const state = await getState(config.statePath);
    const url = new URL(
      `api/provision/yaml?id=${options.projectId}`,
      config.endpoint
    );
    logger.debug('Fetching project spec from ', url)

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
      },
    });

    // TODO - what if the request was denied (406) or 404?

    const resolvedPath = path.resolve(config.specPath);
    logger.debug('reading spec from', resolvedPath)
    // @ts-ignore
    await fs.writeFile(resolvedPath, res.body!);
    const spec = await getSpec(config.specPath);
    logger.debug('validated spec: ', spec)

    if (spec.errors) {
      logger.error('ERROR: invalid spec');
      logger.error(spec.errors);
      process.exitCode = 1;
      process.exit(1);
    }

    const nextState = mergeSpecIntoState(state, spec.doc);
    await fs.writeFile(
      path.resolve(config.statePath),
      JSON.stringify(nextState)
    );

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
