// beta v2 version of CLI pull
// Should be super lightweight
// Fetches from provisioner
// converts into project
// serializes project

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
import Project from '@openfn/project';
import { deployProject } from '@openfn/deploy';
import type { Logger } from '../util/logger';
import { PullOptions } from '../pull/command';

// new config
type Config = {
  endpoint: string;
  apiKey: string | null;

  // maybe keep?
  requireConfirmation?: boolean;
  dryRun?: boolean;

  // configPath?: string;
  // specPath: string;
  // statePath: string;
};

export async function handler(options: DeployOptions, logger: Logger) {
  const { OPENFN_API_KEY, OPENFN_ENDPOINT } = process.env;
  // TODO pull and deploy both need this setup
  let { apiKey, endpoint } = options;

  if (!apiKey && OPENFN_API_KEY) {
    logger.info('Using OPENFN_API_KEY environment variable');
    apiKey = OPENFN_API_KEY;
  }

  // but endpoint should be in the config
  // maybe users can pass a new endpoint to create a new deployment
  // if (!endpoint && OPENFN_ENDPOINT) {
  //   logger.info('Using OPENFN_ENDPOINT environment variable');
  //   endpoint = OPENFN_ENDPOINT;
  // }

  /*
   So how does deploy work?

   Well, we deploy what's on the current filesystem, the currently checked out project

   so first of all, let's parse that
  */

  // TMP use options.path to set the directory for now
  // We'll need to manage this a bit better
  const project = await Project.from('fs', options.path);

  // TODO this feels very incomplete?
  // console.log(project);

  // TODO: work out if there's any diff

  // generate state for the provisioner
  const state = project.serialize('state', { format: 'json' });
  logger.debug('Converted local project to app state:');
  logger.debug(JSON.stringify(state, null, 2));

  const config = {
    endpoint: endpoint || project.openfn.endpoint,
    apiKey,
  };

  // THis fails right now becuase the serialized workflow does not have an id!

  logger.info('Sending project to app...');

  // TODO do I really want to use this deploy function? Is it suitable?
  await deployProject(config, state);

  logger.success('Updated project at', endpoint);
}
