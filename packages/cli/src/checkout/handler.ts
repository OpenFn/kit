import { Workspace } from '@openfn/project';
import path from 'path';
import type { Logger } from '../util/logger';
import type { CheckoutOptions } from './command';
import fs from 'fs';
import { rimraf } from 'rimraf';

const checkoutHandler = async (options: CheckoutOptions, logger: Logger) => {
  console.log({ cwd: process.cwd() });
  const commandPath = path.resolve(options.projectPath ?? '.');
  const workspace = new Workspace(commandPath);
  if (!workspace.valid) {
    logger.error('Command was run in an invalid openfn workspace');
    return;
  }

  // get the project
  const switchProject = workspace.get(options.projectName);
  if (!switchProject) {
    logger.error(
      `Project with id/name ${options.projectName} not found in the workspace`
    );
    return;
  }
  // get the config
  // TODO: try to retain the endpoint for the projects
  const config = workspace.getConfig();

  // delete workflow dir before expanding project
  await rimraf(path.join(commandPath, config?.workflowRoot || 'workflows'));

  // expand project into directory
  const files = switchProject.serialize('fs');
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
