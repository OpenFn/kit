import yargs from 'yargs';
import { Workspace } from '@openfn/project';

import { build, ensure, override } from '../util/command-builders';
import { handler as fetch } from './fetch';
import { handler as checkout } from './checkout';
import * as o from '../options';
import * as o2 from './options';

import type { Logger } from '../util/logger';
import type { Opts } from './options';

export type PullOptions = Pick<
  Opts,
  | 'command'
  | 'alias'
  | 'workspace'
  | 'apiKey'
  | 'endpoint'
  | 'log'
  | 'logJson'
  | 'statePath'
  | 'project'
  | 'confirm'
  | 'snapshots'
>;

const options = [
  // local options
  // TODO: need to port more of these
  o2.alias,
  o2.env,
  o2.workspace,

  // general options
  o.apiKey,
  o.endpoint,
  o.log,
  override(o.path, {
    description: 'path to output the project to',
  }),
  o.logJson,
  o.snapshots,
  o.path,
  o.force,
];

export const command: yargs.CommandModule<PullOptions> = {
  command: 'pull [project]',
  describe: `Pull a project from a Lightning Instance and expand to the file system (ie fetch + checkout)`,
  builder: (yargs: yargs.Argv<PullOptions>) =>
    build(options, yargs)
      .positional('project', {
        describe: 'The UUID, local id or local alias of the project to pull',
      })
      .example(
        'pull 57862287-23e6-4650-8d79-e1dd88b24b1c',
        'Pull project with a UUID from a lightning instance'
      ),
  handler: ensure('project-pull', options),
};

export async function handler(options: PullOptions, logger: Logger) {
  options.workspace ??= process.cwd();
  ensureProjectId(options, logger);

  await fetch(options, logger);
  logger.success(`Downloaded latest project version`);

  await checkout(options, logger);
  logger.success(`Checked out project locally`);
}

const ensureProjectId = (options: any, logger?: Logger) => {
  if (!options.project) {
    logger?.debug(
      'No project ID specified: looking up checked out project in Workspace'
    );
    const ws = new Workspace(options.workspace);
    if (ws.activeProject) {
      options.project = ws.activeProject.uuid;
      logger?.info(
        `Project id not provided: will default to ${options.project}`
      );
    } else {
      throw new Error(
        'Project not provided: specify a project UUID, id or alias'
      );
    }
  }
};

export default handler;
