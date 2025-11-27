// beta v2 version of CLI pull
import path from 'node:path';
import fs from 'node:fs/promises';
import { rimraf } from 'rimraf';
import { confirm } from '@inquirer/prompts';

import { DeployConfig, getProject } from '@openfn/deploy';
import Project, { Workspace } from '@openfn/project';
import { Provisioner } from '@openfn/lexicon/lightning';

import type { Logger } from '../util/logger';
import type { Opts } from '../options';

// new config
type Config = {
  endpoint: string;
  apiKey: string | null;

  // maybe keep?
  requireConfirmation?: boolean;
  dryRun?: boolean;
};

export type PullOptionsBeta = Required<
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

export async function handler(options: PullOptionsBeta, logger: Logger) {
  const { OPENFN_API_KEY, OPENFN_ENDPOINT } = process.env;

  const cfg: Partial<Config> = {
    apiKey: options.apiKey,
    endpoint: options.endpoint,
  };

  if (!options.apiKey && OPENFN_API_KEY) {
    logger.info('Using OPENFN_API_KEY environment variable');
    cfg.apiKey = OPENFN_API_KEY;
  }

  if (!options.endpoint && OPENFN_ENDPOINT) {
    logger.info('Using OPENFN_ENDPOINT environment variable');
    cfg.endpoint = OPENFN_ENDPOINT;
  }

  // TODO `path` or `output` ?
  // I don't think I want to model this as output. deploy is really
  // designed to run from the working folder
  // could be projectPath or repoPath too
  const outputRoot = path.resolve(options.path || '.');

  // TODO is outputRoot the right dir for this?
  const workspace = new Workspace(outputRoot);
  const config = workspace.getConfig();

  // download the state.json from lightning
  const { data } = await getProject(cfg as DeployConfig, options.projectId);

  // TODO if the user doesn't specify an env name, prompt for one
  const name = options.env || 'project';

  const project = await Project.from(
    'state',
    data as Provisioner.Project,
    {
      endpoint: cfg.endpoint,
      env: name,
      fetched_at: new Date().toISOString(),
    },
    config
  );

  const projectFileName = project.getIdentifier();

  await fs.mkdir(`${outputRoot}/.projects`, { recursive: true });
  const stateOutputPath = `${outputRoot}/.projects/${projectFileName}`;

  const workflowsRoot = path.resolve(
    outputRoot,
    project.config.dirs.workflows ?? 'workflows'
  );
  // Prompt before deleting
  // TODO this is actually the wrong path
  if (
    !(await confirm({
      message: `This will remove all files in ${path.resolve(
        workflowsRoot
      )}. Are you sure you wish to proceed?
`,
      default: true,
    }))
  ) {
    logger.always('Cancelled');
    return false;
  }
  await rimraf(workflowsRoot);

  const projFile = project?.serialize('project');

  if (typeof projFile === 'string') {
    await fs.writeFile(`${stateOutputPath}.yaml`, projFile);
  } else {
    await fs.writeFile(
      `${stateOutputPath}.json`,
      JSON.stringify(projFile, null, 2)
    );
  }
  logger.success(`Saved project file to ${stateOutputPath}`);

  const files = project?.serialize('fs');
  for (const f in files) {
    if (files[f]) {
      await fs.mkdir(path.join(outputRoot, path.dirname(f)), {
        recursive: true,
      });
      await fs.writeFile(path.join(outputRoot, f), files[f]);
    } else {
      console.log('WARNING! No content for file', f);
    }
  }
  logger.success(`Expanded project to ${outputRoot}`);
}
