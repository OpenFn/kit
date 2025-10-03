import Project, { Workspace } from '@openfn/project';
import path from 'path';
import type { Logger } from '../util/logger';
import type { MergeOptions } from './command';
import { promises as fs } from 'fs';
import checkoutHandler from '../checkout/handler';

const mergeHandler = async (options: MergeOptions, logger: Logger) => {
  const commandPath = path.resolve(process.cwd(), options.projectPath ?? '.');
  const workspace = new Workspace(commandPath);
  if (!workspace.valid) {
    logger.error('Command was run in an invalid openfn workspace');
    return;
  }

  const checkedProject = workspace.getActiveProject();
  if (!checkedProject) {
    logger.error(`No project currently checked out`);
    return;
  }

  const mProject = workspace.get(options.projectName);
  if (!mProject) {
    logger.error(
      `Project with id/name ${options.projectName} not found in the workspace`
    );
    return;
  }

  if (checkedProject.name === mProject.name) {
    logger.error('Merging into the same project not allowed');
    return;
  }

  if (!checkedProject.name) {
    logger.error('The checked out project has no name/id');
    return;
  }

  const finalPath = workspace.getProjectPath(checkedProject.name);
  if (!finalPath) {
    logger.error('Path to checked out project not found.');
    return;
  }

  // TODO pick options from the terminal
  const final = Project.merge(mProject, checkedProject, {
    removeUnmapped: options.removeUnmapped,
    workflowMappings: options.workflowMappings,
  });
  const yaml = final.serialize('state', { format: 'yaml' });
  await fs.writeFile(finalPath, yaml);

  // Checkout after merge. to unwrap updated files into filesystem
  await checkoutHandler(
    {
      command: 'checkout',
      projectPath: commandPath,
      projectName: final.name || '',
    },
    logger
  );
  logger.success(
    `Project ${mProject.name} has been merged into Project ${checkedProject.name} successfully`
  );
};

export default mergeHandler;
