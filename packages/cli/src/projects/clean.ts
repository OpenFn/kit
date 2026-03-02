import yargs from 'yargs';
import { Workspace } from '@openfn/project';
import { rimraf } from 'rimraf';

import { build, ensure } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';
import * as po from './options';

import type { Opts } from './options';

export type CleanOptions = Pick<Opts, 'command' | 'workspace' | 'log'>;

const options = [o.log, po.workspace];

const command: yargs.CommandModule = {
  command: 'clean',
  describe: 'Delete the workflows folder for the currently active project',
  handler: ensure('project-clean', options),
  builder: (yargs) => build(options, yargs),
};

export default command;

export const handler = async (options: CleanOptions, logger: Logger) => {
  const workspacePath = options.workspace ?? process.cwd();
  const workspace = new Workspace(workspacePath, logger);

  await rimraf(workspace.workflowsPath);
  logger.success(`Removed workflows directory at ${workspace.workflowsPath}`);
};
