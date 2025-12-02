import yargs from 'yargs';
import Project, { Workspace } from '@openfn/project';
import path from 'path';
import fs from 'fs';
import { rimraf } from 'rimraf';

import { ensure, build } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';

import type { Opts } from '../options';

export type CheckoutOptions = Pick<
  Opts,
  'command' | 'projectId' | 'workspace' | 'log'
>;

const options = [o.projectId, o.workspace, o.log];

const command: yargs.CommandModule = {
  command: 'checkout <project-id>',
  describe: 'Switch to a different openfn project in the same workspace',
  handler: ensure('project-checkout', options),
  builder: (yargs) => build(options, yargs),
};

export default command;

export const handler = async (options: CheckoutOptions, logger: Logger) => {
  const projectId = options.projectId!;
  const workspacePath = options.workspace ?? process.cwd();
  const workspace = new Workspace(workspacePath);
  if (!workspace.valid) {
    throw new Error('Command was run in an invalid openfn workspace');
  }

  // get the config
  // TODO: try to retain the endpoint for the projects
  const { project: _, ...config } = workspace.getConfig() as any;

  // get the project
  let switchProject;
  if (/\.(yaml|json)$/.test(projectId)) {
    // TODO: should we allow checkout into an arbitrary folder?
    const filePath = projectId.startsWith('/')
      ? projectId
      : path.join(workspacePath, projectId);
    logger.debug('Loading project from path ', filePath);
    switchProject = await Project.from('path', filePath, config);
  } else {
    switchProject = workspace.get(projectId);
  }

  if (!switchProject) {
    throw new Error(`Project with id ${projectId} not found in the workspace`);
  }

  // delete workflow dir before expanding project
  await rimraf(path.join(workspacePath, config.workflowRoot ?? 'workflows'));

  // expand project into directory
  const files: any = switchProject.serialize('fs');
  for (const f in files) {
    if (files[f]) {
      fs.mkdirSync(path.join(workspacePath, path.dirname(f)), {
        recursive: true,
      });
      fs.writeFileSync(path.join(workspacePath, f), files[f]);
    } else {
      logger.warn('WARNING! No content for file', f);
    }
  }
  logger.success(`Expanded project to ${workspacePath}`);
};
