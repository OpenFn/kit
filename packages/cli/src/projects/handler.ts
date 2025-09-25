import type { ProjectsOptions } from './command';
import type { Logger } from '../util/logger';
import path from 'path';
import fs from 'fs';
import getFsProjects from './get-projects';

const projectsHandler = async (options: ProjectsOptions, logger: Logger) => {
  const commandPath = options.projectPath ?? process.cwd();
  // look for .projects folder
  const projectsDir = path.join(commandPath, '.projects');
  if (!fs.existsSync(projectsDir) || !fs.statSync(projectsDir).isDirectory()) {
    logger.error('.projects folder not found');
    return;
  }
  const projects = await getFsProjects(projectsDir, logger);
  if (!projects.length) {
    logger.error('No openfn projects available');
  }

  process.stdout.write(
    `Available openfn projects\n\n${projects
      .map((p) => p.name + (p.active ? ' (active)' : ''))
      .join('\n')}\n\n`
  );
};

export default projectsHandler;
