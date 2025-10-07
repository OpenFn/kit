import Project, { Workspace } from '@openfn/project';
import path from 'path';
import type { Logger } from '../util/logger';
import type { ProjectsOptions } from './command';

const projectsHandler = async (options: ProjectsOptions, logger: Logger) => {
  const commandPath = path.resolve(options.projectPath ?? '.');
  const workspace = new Workspace(commandPath);
  if (!workspace.valid) {
    logger.error('Command was run in an invalid openfn workspace');
    return;
  }

  logger.success(`Available openfn projects\n\n${workspace
    .list()
    .map((p) => describeProject(p, p.name === workspace.activeProjectId))
    .join('\n\n')}
    `);
};

function describeProject(project: Project, active = false) {
  // @ts-ignore
  const pId = project.openfn?.uuid;
  return `${project.name} ${active ? '(active)' : ''}\n  ${
    pId || '<project-id>'
  }\n  workflows:\n${project.workflows
    .map((w) => '    - ' + w.name)
    .join('\n')}`;
}

export default projectsHandler;
