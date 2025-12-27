// beta v2 version of CLI deploy

import Project from '@openfn/project';
import { DeployConfig, deployProject } from '@openfn/deploy';
import type { Logger } from '../util/logger';
import { Opts } from '../options';
import { loadAppAuthConfig } from '../projects/util';

export type DeployOptionsBeta = Required<
  Pick<
    Opts,
    'beta' | 'command' | 'log' | 'logJson' | 'apiKey' | 'endpoint' | 'path'
  >
>;

export async function handler(options: DeployOptionsBeta, logger: Logger) {
  const config = loadAppAuthConfig(options, logger);

  // TMP use options.path to set the directory for now
  // We'll need to manage this a bit better
  // TODO this is fixed on another branch
  const project = await Project.from('fs', {
    root: (options as any).workspace || '.',
  });
  // TODO: work out if there's any diff

  // generate state for the provisioner
  const state = project.serialize('state', { format: 'json' });

  logger.debug('Converted local project to app state:');
  logger.debug(JSON.stringify(state, null, 2));

  // TODO not totally sold on endpoint handling right now
  config.endpoint ??= project.openfn?.endpoint!;

  logger.info('Sending project to app...');

  // TODO do I really want to use this deploy function? Is it suitable?
  await deployProject(config as DeployConfig, state);

  logger.success('Updated project at', config.endpoint);
}
