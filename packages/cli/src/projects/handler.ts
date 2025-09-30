import { Workspace } from '@openfn/project';
import path from 'path';
import type { Logger } from '../util/logger';
import type { ProjectsOptions } from './command';

const projectsHandler = async (options: ProjectsOptions, logger: Logger) => {
  const commandPath = path.resolve(process.cwd(), options.projectPath ?? '.');
  const workspace = new Workspace(commandPath);
  if (!workspace.valid) {
    logger.error('Command was run in an invalid openfn workspace');
    return;
  }

  logger.success(`Available openfn projects\n\n${workspace
    .list()
    .map((p) => p.describe())
    .join('\n\n')}
    `);
};

export default projectsHandler;
