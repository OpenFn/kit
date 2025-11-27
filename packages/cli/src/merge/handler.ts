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

  let targetProject: Project;
  if (options.base) {
    const basePath = path.resolve(options.base);
    logger.debug('Loading target project from path', basePath);
    targetProject = await Project.from('path', basePath);
  } else {
    targetProject = workspace.getActiveProject()!;
    if (!targetProject) {
      logger.error(`No project currently checked out`);
      return;
    }
    logger.debug(`Loading target project from workspace (${targetProject.id})`);
  }

  // Lookup the source project - the thing we are getting changes from
  let sourceProject;
  if (/\.(yaml|json)$/.test(options.projectId)) {
    const filePath = path.join(commandPath, options.projectId);
    logger.debug('Loading source project from path ', filePath);
    sourceProject = await Project.from('path', filePath);
  } else {
    logger.debug(`Loading source project from workspace ${options.projectId}`);
    sourceProject = workspace.get(options.projectId);
  }
  if (!sourceProject) {
    logger.error(`Project "${options.projectId}" not found in the workspace`);
    return;
  }

  if (targetProject.id === sourceProject.id) {
    logger.error('Merging into the same project not allowed');
    return;
  }

  if (!targetProject.id) {
    logger.error('The checked out project has no id');
    return;
  }
  const finalPath =
    options.outputPath ?? workspace.getProjectPath(targetProject.id);
  if (!finalPath) {
    logger.error('Path to checked out project not found.');
    return;
  }
  const final = Project.merge(sourceProject, targetProject, {
    removeUnmapped: options.removeUnmapped,
    workflowMappings: options.workflowMappings,
    force: options.force,
  });

  let outputFormat = workspace.config!.formats.project;
  // If outputPath has a JSON file extension, use that
  if (options.outputPath?.endsWith('.json')) {
    outputFormat = 'json';
  } else if (options.outputPath?.endsWith('.yaml')) {
    outputFormat = 'yaml';
  }

  let finalState = final.serialize('state', {
    format: outputFormat,
  });
  if (outputFormat === 'json') {
    finalState = JSON.stringify(finalState, null, 2);
  }
  await fs.writeFile(finalPath, finalState as string);

  logger.info(`Updated statefile at `, finalPath);

  logger.info('Checking out merged project to filesystem');

  // TODO support --no-checkout to merge without expanding

  // Checkout after merge. to unwrap updated files into filesystem
  await checkoutHandler(
    {
      command: 'checkout',
      projectPath: commandPath,
      projectId: options.outputPath ? finalPath : final.id,
      log: options.log,
    },
    logger
  );
  logger.success(
    `Project ${sourceProject.id} has been merged into Project ${targetProject.id} successfully`
  );
};

export default mergeHandler;
