import path from 'path';
import fs from 'node:fs/promises';
import {
  DeployConfig,
  getConfig,
  getProject,
  getSpec,
  getStateFromProjectPayload,
  syncRemoteSpec,
} from '@openfn/deploy';
import type { Logger } from '../util/logger';
import { PullOptions } from '../pull/command';

async function pullHandler(options: PullOptions, logger: Logger) {
  try {
    const config = mergeOverrides(await getConfig(options.configPath), options);

    if (process.env['OPENFN_API_KEY']) {
      logger.info('Using OPENFN_API_KEY environment variable');
      config.apiKey = process.env['OPENFN_API_KEY'];
    }

    if (process.env['OPENFN_ENDPOINT']) {
      logger.info('Using OPENFN_ENDPOINT environment variable');
      config.endpoint = process.env['OPENFN_ENDPOINT'];
    }

    logger.always(
      'Downloading existing project state (as JSON) from the server.'
    );

    // Get the project.json from Lightning
    const { data: project } = await getProject(
      config,
      options.projectId,
      options.snapshots
    );

    if (!project) {
      logger.error('ERROR: Project not found.');
      logger.warn(
        'Please check the UUID and verify your endpoint and apiKey in your config.'
      );
      process.exitCode = 1;
      process.exit(1);
    }

    // Build the state.json
    const state = getStateFromProjectPayload(project!);

    logger.always('Downloading the project spec (as YAML) from the server.');
    // Get the project.yaml from Lightning
    const queryParams = new URLSearchParams();
    queryParams.append('id', options.projectId);
    options.snapshots?.forEach((snapshot) =>
      queryParams.append('snapshots[]', snapshot)
    );
    const url = new URL(
      `api/provision/yaml?${queryParams.toString()}`,
      config.endpoint
    );
    logger.debug('Fetching project spec from', url);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
      },
    });

    if (res.status != 200) {
      logger.error('ERROR: Project spec not retrieved.');
      logger.warn(
        'No YAML representation of this project could be retrieved from the server.'
      );
      process.exitCode = 1;
      process.exit(1);
    }

    const resolvedPath = path.resolve(config.specPath);
    logger.debug('reading spec from', resolvedPath);

    const updatedSpec = await syncRemoteSpec(
      await res.text(),
      state,
      config,
      logger
    );

    // Write the final project state and yaml to disk
    await fs.writeFile(
      path.resolve(config.statePath),
      JSON.stringify(state, null, 2)
    );

    await fs.writeFile(resolvedPath, updatedSpec);

    // Read the spec back in a parsed yaml
    const spec = await getSpec(resolvedPath);

    if (spec.errors.length > 0) {
      logger.error('ERROR: invalid spec');
      logger.error(spec.errors);
      process.exitCode = 1;
      process.exit(1);
    }

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
