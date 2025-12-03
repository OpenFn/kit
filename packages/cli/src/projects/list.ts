import yargs from 'yargs';
import Project, { Workspace } from '@openfn/project';

import { ensure, build } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';

import type { Opts } from '../options';

export type ProjectsOptions = Required<Pick<Opts, 'command' | 'workspace'>>;

const options = [o.log, o.workspace];

const command: yargs.CommandModule = {
  command: 'list [project-path]',
  describe: 'List all the openfn projects available in the current directory',
  aliases: ['project', '$0'],
  handler: ensure('project-list', options),
  builder: (yargs) => build(options, yargs),
};

export default command;

export const handler = async (options: ProjectsOptions, logger: Logger) => {
  logger.info('Searching for projects in workspace at:');
  logger.info(' ', options.workspace);
  logger.break();

  const workspace = new Workspace(options.workspace);

  if (!workspace.valid) {
    // TODO how can we be more helpful here?
    throw new Error('No OpenFn projects found');
  }

  logger.always(`Available openfn projects\n\n${workspace
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
