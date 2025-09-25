import type { CheckoutOptions } from './command';
import type { Logger } from '../util/logger';
import getFsProjects from '../projects/get-projects';
import path from 'path';
import fs from 'fs';

const checkoutHandler = async (options: CheckoutOptions, logger: Logger) => {
  const commandPath = path.resolve(process.cwd(), options.projectPath ?? '.');
  const idOrName = options.projectId;
  // look for .projects folder
  const projectsDir = path.join(commandPath, '.projects');
  if (!fs.existsSync(projectsDir) || !fs.statSync(projectsDir).isDirectory()) {
    logger.error('.projects folder not found');
    return;
  }
  const projects = await getFsProjects(projectsDir, logger);
  if (!projects.length) {
    logger.error('No openfn projects available');
    return;
  }

  const checkoutProject = projects.find(
    (p) => p.id === idOrName || p.name === idOrName
  );
  if (!checkoutProject) {
    logger.error(`No openfn project found with id or name ${idOrName}`);
    return;
  }

  //TODO do the actual checking out of the project.
  console.log('checking out to', idOrName);
};

export default checkoutHandler;
