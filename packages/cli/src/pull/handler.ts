import path from 'path';
import fs from 'node:fs/promises';
import {
  DeployConfig,
  getConfig,
  getProject,
  mergeProjectPayloadIntoState,
  mergeSpecIntoState,
  getSpec,
  getStateFromProjectPayload,
} from '@openfn/deploy';
import type { Logger } from '../util/logger';
import { PullOptions } from '../pull/command';
import assertPath from '../util/assert-path';
import { option } from 'yargs';

async function pullHandler(options: PullOptions, logger: Logger) {
  try {
    assertPath(options.projectId);
    const config = mergeOverrides(await getConfig(options.configPath), options);
    logger.always(
      'Downloading project.yaml and projectState.json from instance'
    );

    // First get the project.yaml from Lightning
    const url = new URL(
      `api/provision/yaml?id=${options.projectId}`,
      config.endpoint
    );
    logger.debug('Fetching project spec from', url);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
      },
    });

    const resolvedPath = path.resolve(config.specPath);
    logger.debug('reading spec from', resolvedPath);

    // Write the yaml down to disk
    await fs.writeFile(resolvedPath, res.body!);

    // Read the spec back in a parsed yaml
    const spec = await getSpec(resolvedPath);
    // logger.debug('validated spec: ', JSON.stringify(spec.doc, null, 2));

    // Get the latest project from Lightning
    // TODO - what if the request was denied (406) or 404?
    const { data: project } = await getProject(config, options.projectId);
    console.log('the project from server:', JSON.stringify(project, null, 2));
    const finalState = getStateFromProjectPayload(project);

    // // Merge the spec into state
    // // TODO Need to intialise new state with uuids from the project
    // const finalState = mergeProjectPayloadIntoState(
    //   getStateFromProjectPayload(project),
    //   spec.doc
    // );
    console.log(JSON.stringify(finalState, null, 2));

    // const finalState = mergeSpecIntoState(x, spec.doc);
    // console.log(spec);
    // console.log('newState ID:', JSON.stringify(newState.id));

    // Now merge the project into the state

    // And finally write the final, deployed state to disk
    await fs.writeFile(
      path.resolve(config.statePath),
      JSON.stringify(finalState, null, 2)
    );

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
