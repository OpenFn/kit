import yargs from 'yargs';
import Project, { Workspace } from '@openfn/project';

import { ensure, build } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';
import * as po from './options';

import type { Opts } from './options';
import abort from '../util/abort';

export type ProjectListOptions = Pick<Opts, 'log' | 'workspace'>;

const options = [o.log, po.workspace];

const command: yargs.CommandModule = {
  command: 'list [project-path]',
  describe: 'List all the openfn projects available in the current directory',
  aliases: ['project', '$0'],
  handler: ensure('project-list', options),
  builder: (yargs) => build(options, yargs),
};

export default command;

export const handler = async (options: ProjectListOptions, logger: Logger) => {
  logger.info('Searching for projects in workspace at:');
  logger.info(' ', options.workspace);
  logger.break();

  const workspace = new Workspace(options.workspace!);

  if (!workspace.valid) {
    // TODO how can we be more helpful here?
    // eg, this will happen if there's no openfn.yaml file
    // basically we need the workspace to return a reason
    // (again, I'm thinking of removing the validation entirely)
    abort(logger, `No OpenFn projects found at ${options.workspace}`, {
      fix: 'Run this command from a folder with an openfn.yaml file, or pass --workspace to set the workspace root',
    });
  }

  logger.always(`Available openfn projects\n\n${workspace
    .list()
    .map((p) => describeProject(p, p === workspace.getTrackedProject()))
    .join('\n\n')}
    `);
};

function describeProject(project: Project, active = false) {
  // @ts-ignore
  const uuid = project.openfn?.uuid;
  return `${project.alias || '(no alias)'} | ${project.id} ${
    active ? '(active)' : ''
  }\n  ${uuid || '<project-id>'}\n  workflows:\n${project.workflows
    .map((w) => '    - ' + w.id)
    .join('\n')}`;
}
