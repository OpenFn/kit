import Project, { Workspace } from '@openfn/project';
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

  const config = workspace.getConfig();
  logger.success(`Available openfn projects\n\n${workspace
    .list()
    .map((p) => describeProject(p, p.name === config.name))
    .join('\n\n')}
    `);
};

function describeProject(project: Project, active = false) {
  return `${project.name} ${active ? '(active)' : ''}\n  ${
    project.openfn?.projectId || '<project-id>'
  }\n  workflows:\n${project.workflows
    .map((w) => '    - ' + w.name)
    .join('\n')}`;
}

export default projectsHandler;
