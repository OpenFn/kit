import Project, { Workspace } from '@openfn/project';
import path from 'path';
import type { Logger } from '../util/logger';
import type { MergeOptions } from './command';
import { promises as fs } from 'fs';
import checkoutHandler from '../checkout/handler';

const mergeHandler = async (options: MergeOptions, logger: Logger) => {
  const commandPath = path.resolve(options.projectPath ?? '.');
  const workspace = new Workspace(commandPath);
  if (!workspace.valid) {
    logger.error('Command was run in an invalid openfn workspace');
    return;
  }

  // The target project - the think we apply changes to - is
  // whatever is checked out
  const targetProject = workspace.getActiveProject();
  if (!targetProject) {
    logger.error(`No project currently checked out`);
    return;
  }

  // Lookup the source project - the thing we are getting changes from
  let sourceProject;
  if (/\.(yaml|json)$/.test(options.projectName)) {
    const filePath = path.join(commandPath, options.projectName);
    logger.debug('Loading source project from path ', filePath);
    sourceProject = await Project.from('path', filePath);
  } else {
    sourceProject = workspace.get(options.projectName);
  }
  if (!sourceProject) {
    logger.error(`Project "${options.projectName}" not found in the workspace`);
    return;
  }

  if (targetProject.name === sourceProject.name) {
    logger.error('Merging into the same project not allowed');
    return;
  }

  if (!targetProject.name) {
    logger.error('The checked out project has no name/id');
    return;
  }

  const finalPath = workspace.getProjectPath(targetProject.name);
  if (!finalPath) {
    logger.error('Path to checked out project not found.');
    return;
  }

  // TODO pick options from the terminal
  const final = Project.merge(sourceProject, targetProject, {
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
    `Project ${sourceProject.name} has been merged into Project ${targetProject.name} successfully`
  );
};

export default mergeHandler;
