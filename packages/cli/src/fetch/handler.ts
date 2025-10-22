import { DeployConfig, getProject } from '@openfn/deploy';
import Project from '@openfn/project';
import fs from 'node:fs/promises';
import path from 'path';
import { Opts } from '../options';
import type { Logger } from '../util/logger';

type Config = {
  endpoint: string;
  apiKey: string | null;

  requireConfirmation?: boolean;
  dryRun?: boolean;
};

export type FetchOptions = Required<
  Pick<
    Opts,
    | 'apiKey'
    | 'beta'
    | 'command'
    | 'confirm'
    | 'endpoint'
    | 'env'
    | 'log'
    | 'logJson'
    | 'path'
    | 'projectId'
  >
>;

export default async function fetchHandler(
  options: FetchOptions,
  logger: Logger
) {
  const { OPENFN_API_KEY, OPENFN_ENDPOINT } = process.env;

  const config: Partial<Config> = {
    apiKey: options.apiKey,
    endpoint: options.endpoint,
  };

  if (!options.apiKey && OPENFN_API_KEY) {
    logger.info('Using OPENFN_API_KEY environment variable');
    config.apiKey = OPENFN_API_KEY;
  }

  if (!options.endpoint && OPENFN_ENDPOINT) {
    logger.info('Using OPENFN_ENDPOINT environment variable');
    config.endpoint = OPENFN_ENDPOINT;
  }

  // download the state.json from lightning
  const { data } = await getProject(config as DeployConfig, options.projectId);
  const name = options.env || 'project';

  const project = Project.from('state', data, {
    endpoint: config.endpoint,
    env: name,
    fetched_at: new Date().toISOString(),
  });

  const outputRoot = path.resolve(options.path || '.');

  const projectFileName = project.getIdentifier();

  await fs.mkdir(`${outputRoot}/.projects`, { recursive: true });
  let stateOutputPath = `${outputRoot}/.projects/${projectFileName}`;

  const state = project?.serialize('state');
  if (project.repo?.formats.project === 'yaml') {
    await fs.writeFile(`${stateOutputPath}.yaml`, state);
  } else {
    await fs.writeFile(
      `${stateOutputPath}.json`,
      JSON.stringify(state, null, 2)
    );
  }
  logger.success(`Fetched project file to ${stateOutputPath}`);
}
