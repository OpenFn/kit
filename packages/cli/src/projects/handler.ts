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
    .map((p) => describeProject(p, p.id === workspace.activeProjectId))
    .join('\n\n')}
    `);
};

function describeProject(project: Project, active = false) {
  // @ts-ignore
  const uuid = project.openfn?.uuid;
  return `${project.id} ${active ? '(active)' : ''}\n  ${
    uuid || '<project-id>'
  }\n  workflows:\n${project.workflows.map((w) => '    - ' + w.id).join('\n')}`;
}

export default projectsHandler;
