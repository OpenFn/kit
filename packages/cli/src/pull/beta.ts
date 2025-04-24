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

// TODO need to document and add options.env
export async function handler(options: PullOptions, logger: Logger) {
  const { OPENFN_API_KEY, OPENFN_ENDPOINT } = process.env;

  const config: Partial<Config> = {};

  // TODO this all needs fixing
  if (!options.key && OPENFN_API_KEY) {
    logger.info('Using OPENFN_API_KEY environment variable');
    config.apiKey = OPENFN_API_KEY;
  }

  if (!options.endpoint && OPENFN_ENDPOINT) {
    logger.info('Using OPENFN_ENDPOINT environment variable');
    config.endpoint = OPENFN_ENDPOINT;
  }

  // download the state.json
  const { data } = await getProject(
    config as any,
    options.projectId
    // options.snapshots
  );

  // TODO if the user doesn't specify an env name, prompt for one
  const name = options.env || 'project';

  const project = Project.from('state', data, {
    endpoint: config.endpoint,
    env: name,
  });

  // so this thing is my project.yaml file
  // name@domain
  // I have no control over this - it's whatever the provisioner wants
  // But I can serialize my Project however I want right? options,workflows,meta

  // Ah that settles it!
  // The local project.yaml files contain stuff that the provisioner project does not
  // eg the endpoint and maybe a local name
  // so what we serialise is a Json Project, not a provisioner state file
  const outputPath = `./tmp/projects/${name}@${extractDomain(
    config.endpoint
  )}.json`;
  await fs.writeFile(
    outputPath,
    JSON.stringify(project?.serialize('json'), null, 2)
  );
  logger.success(`Saved project to ${outputPath}`);
}

const extractDomain = (endpoint: string) => {
  return new URL(endpoint).hostname;
};
