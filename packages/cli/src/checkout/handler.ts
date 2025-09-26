import type { CheckoutOptions } from './command';
import type { Logger } from '../util/logger';
import getFsProjects from '../projects/get-projects';
import path from 'path';
import fs from 'fs';
import Project, { yamlToJson } from '@openfn/project';
import { rimraf } from 'rimraf';

const checkoutHandler = async (options: CheckoutOptions, logger: Logger) => {
  const commandPath = path.resolve(process.cwd(), options.projectPath ?? '.');
  // local name (alias)
  // remote name (actual project name)
  const idOrName = options.projectId;
  // look for .projects folder
  const projectsDir = path.join(commandPath, '.projects');
  if (!fs.existsSync(projectsDir) || !fs.statSync(projectsDir).isDirectory()) {
    logger.error('.projects folder not found');
    return;
  }
  const availableProjects = await getFsProjects(projectsDir, logger);
  if (!availableProjects.length) {
    logger.error('No openfn projects available');
    return;
  }

  const checkoutProject = availableProjects.find(
    (p) => p.id === idOrName || p.name === idOrName
  );
  if (!checkoutProject) {
    logger.error(`No openfn project found with id or name ${idOrName}`);
    return;
  }

  //TODO do the actual checking out of the project.
  // read the file of the found item. into workflow and openfn.yaml
  const appState = yamlToJson(
    fs.readFileSync(path.join(projectsDir, checkoutProject.fileName), 'utf-8')
  );
  const project = Project.from('state', appState, {});
  const workflowsRoot = path.resolve(commandPath, 'workflows');
  await rimraf(workflowsRoot);
  const files = project?.serialize('fs');
  for (const f in files) {
    if (files[f]) {
      fs.mkdirSync(path.join(commandPath, path.dirname(f)), {
        recursive: true,
      });
      fs.writeFileSync(path.join(commandPath, f), files[f]);
    } else {
      console.log('WARNING! No content for file', f);
    }
  }
  logger.success(`Checked out and expanded project to ${commandPath}`);
};

export default checkoutHandler;
