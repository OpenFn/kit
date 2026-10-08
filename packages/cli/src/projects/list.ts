import yargs from 'yargs';
import Project, { Workspace } from '@openfn/project';

import { ensure, build } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';
import * as po from './options';

import type { Opts } from './options';
import abort from '../util/abort';
import ensureCheckout from './ensure-checkout';

export type ProjectListOptions = Pick<Opts, 'log' | 'workspace' | 'branch'>;

const options = [o.log, po.workspace, po.branch];

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

  let workspace = new Workspace(options.workspace!, undefined, true, {
    branch: options.branch,
  });

  if (!workspace.valid) {
    // TODO how can we be more helpful here?
    // eg, this will happen if there's no openfn.yaml file
    // basically we need the workspace to return a reason
    // (again, I'm thinking of removing the validation entirely)
    abort(logger, `No OpenFn projects found at ${options.workspace}`, {
      fix: 'Run this command from a folder with an openfn.yaml file, or pass --workspace to set the workspace root',
    });
  }

  // Listing works fine without a checkout: it just can't mark the active
  // project, so there's no need to abort if we can't ask which it is
  workspace = await ensureCheckout(workspace, logger, { required: false });

  // Workflow aliases are folder names, so only the checked out project has them
  const local = await workspace.getCheckedOutProject();

  logger.always(`Available openfn projects\n\n${workspace
    .list()
    .map((p) => {
      const active = p === workspace.getTrackedProject();
      return describeProject(p, active, active ? local : undefined);
    })
    .join('\n\n')}
    `);
};

function describeProject(project: Project, active = false, local?: Project) {
  // @ts-ignore
  const uuid = project.openfn?.uuid;
  return `${project.alias || '(no alias)'} | ${project.id} ${
    active ? '(active)' : ''
  }\n  ${uuid || '<project-id>'}\n  workflows:\n${project.workflows
    .map((w) => {
      const alias = local?.workflows.find((l) => l.id === w.id)?.alias;
      return '    - ' + w.id + (alias ? ` (${alias})` : '');
    })
    .join('\n')}`;
}
