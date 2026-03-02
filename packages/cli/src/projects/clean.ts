import yargs from 'yargs';
import { Workspace } from '@openfn/project';
import { rimraf } from 'rimraf';

import { build, ensure } from '../util/command-builders';
import { handler as checkout } from './checkout';
import type { Logger } from '../util/logger';
import * as o from '../options';
import * as po from './options';

import type { Opts } from './options';

export type CleanOptions = Pick<
  Opts,
  'command' | 'workspace' | 'log' | 'confirm' | 'force'
>;

const options = [o.log, o.confirm, o.force, po.workspace];

const command: yargs.CommandModule = {
  command: 'clean',
  describe:
    'Delete the workflows folder and re-checkout the currently active project',
  handler: ensure('project-clean', options),
  builder: (yargs) => build(options, yargs),
};

export default command;

export const handler = async (options: CleanOptions, logger: Logger) => {
  const workspacePath = options.workspace ?? process.cwd();
  const workspace = new Workspace(workspacePath, logger);

  const skip = options.force || options.confirm === false;
  const doIt = await logger.confirm(
    `This will delete all files in ${workspace.workflowsPath}. Do you want to proceed?`,
    skip
  );
  if (!doIt) {
    return;
  }

  await rimraf(workspace.workflowsPath);

  const activeProject = workspace.activeProject;
  if (!activeProject) {
    throw new Error(
      'No active project found in workspace. Run `project pull` first.'
    );
  }

  const projectId = String(
    activeProject.uuid ?? (activeProject as any).id
  );
  await checkout({ ...options, project: projectId, force: true }, logger);
};
