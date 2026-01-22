import yargs from 'yargs';
import Project, { Workspace } from '@openfn/project';
import path from 'path';
import fs from 'fs';
import { rimraf } from 'rimraf';

import { ensure, build } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';
import * as po from './options';

import type { Opts } from './options';
import { tidyWorkflowDir, updateForkedFrom } from './util';

export type CheckoutOptions = Pick<
  Opts,
  'command' | 'project' | 'workspace' | 'log' | 'clean'
>;

const options = [o.log, po.workspace, po.clean];

const command: yargs.CommandModule = {
  command: 'checkout <project>',
  describe: 'Switch to a different OpenFn project in the same workspace',
  handler: ensure('project-checkout', options),
  builder: (yargs) =>
    build(options, yargs).positional('project', {
      describe: 'The id, alias or UUID of the project to checkout',
      demandOption: true,
    }),
};

export default command;

export const handler = async (options: CheckoutOptions, logger: Logger) => {
  const projectIdentifier = options.project!;
  const workspacePath = options.workspace ?? process.cwd();
  const workspace = new Workspace(workspacePath, logger);

  // get the config
  // TODO: try to retain the endpoint for the projects
  const { project: _, ...config } = workspace.getConfig() as any;

  const currentProject = workspace.getActiveProject();

  // get the project
  let switchProject;
  if (/\.(yaml|json)$/.test(projectIdentifier)) {
    // TODO: should we allow checkout into an arbitrary folder?
    const filePath = projectIdentifier.startsWith('/')
      ? projectIdentifier
      : path.join(workspacePath, projectIdentifier);
    logger.debug('Loading project from path ', filePath);
    switchProject = await Project.from('path', filePath, config);
  } else {
    switchProject = workspace.get(projectIdentifier);
  }

  if (!switchProject) {
    throw new Error(
      `Project with id ${projectIdentifier} not found in the workspace`
    );
  }

  // delete workflow dir before expanding project
  if (options.clean) {
    await rimraf(workspace.workflowsPath);
  } else {
    await tidyWorkflowDir(currentProject!, switchProject);
  }

  // write the forked from map
  updateForkedFrom(switchProject);

  // expand project into directory
  // TODO: only write files with a diff
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
