import Project, { Workspace } from '@openfn/project';
import path from 'path';
import type { Logger } from '../util/logger';
import type { CheckoutOptions } from './command';
import fs from 'fs';
import { rimraf } from 'rimraf';

const checkoutHandler = async (options: CheckoutOptions, logger: Logger) => {
  const commandPath = path.resolve(options.projectPath ?? '.');
  const workspace = new Workspace(commandPath);
  if (!workspace.valid) {
    logger.error('Command was run in an invalid openfn workspace');
    return;
  }

  // get the config
  // TODO: try to retain the endpoint for the projects
  const { project: _, ...config } = workspace.getConfig() as any;

  // get the project
  let switchProject;
  if (/\.(yaml|json)$/.test(options.projectId)) {
    // TODO: should we allow checkout into an arbitrary folder?
    const filePath = options.projectId.startsWith('/')
      ? options.projectId
      : path.join(commandPath, options.projectId);
    logger.debug('Loading project from path ', filePath);
    switchProject = await Project.from('path', filePath, config);
  } else {
    switchProject = workspace.get(options.projectId);
  }

  if (!switchProject) {
    throw new Error(
      `Project with id ${options.projectId} not found in the workspace`
    );
  }

  // delete workflow dir before expanding project
  await rimraf(path.join(commandPath, config.workflowRoot ?? 'workflows'));

  // expand project into directory
  const files: any = switchProject.serialize('fs');
  for (const f in files) {
    if (files[f]) {
      fs.mkdirSync(path.join(commandPath, path.dirname(f)), {
        recursive: true,
      });
      fs.writeFileSync(path.join(commandPath, f), files[f]);
    } else {
      logger.warn('WARNING! No content for file', f);
    }
  }
  logger.success(`Expanded project to ${commandPath}`);
};

export default checkoutHandler;
