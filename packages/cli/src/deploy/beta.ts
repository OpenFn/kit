// beta v2 version of CLI deploy

import Project from '@openfn/project';
import { DeployConfig, deployProject } from '@openfn/deploy';
import type { Logger } from '../util/logger';
import { Opts } from '../options';

export type DeployOptionsBeta = Required<
  Pick<
    Opts,
    'beta' | 'command' | 'log' | 'logJson' | 'apiKey' | 'endpoint' | 'path'
  >
>;

export async function handler(options: DeployOptionsBeta, logger: Logger) {
  const { OPENFN_API_KEY } = process.env;

  const { endpoint } = options;

  const config: Partial<DeployConfig> = {
    apiKey: options.apiKey,
  };

  if (!options.apiKey && OPENFN_API_KEY) {
    logger.info('Using OPENFN_API_KEY environment variable');
    config.apiKey = OPENFN_API_KEY;
  }

  // TMP use options.path to set the directory for now
  // We'll need to manage this a bit better
  const project = await Project.from('fs', { root: options.path || '.' });
  // Why is there an id on openfn here?
  console.log({ openfn: project.openfn });

  // TODO: work out if there's any diff

  // generate state for the provisioner
  const state = project.serialize('state', { format: 'json' });

  logger.debug('Converted local project to app state:');
  logger.debug(JSON.stringify(state, null, 2));

  // TODO not totally sold on endpoint handling right now
  config.endpoint = endpoint || project.openfn?.endpoint;

  logger.info('Sending project to app...');

  // TODO do I really want to use this deploy function? Is it suitable?
  await deployProject(config as DeployConfig, state);

  logger.success('Updated project at', config.endpoint);
}
