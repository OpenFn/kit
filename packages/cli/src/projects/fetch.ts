import yargs from 'yargs';
import path from 'node:path';
import fs from 'node:fs/promises';
import Project, { Workspace } from '@openfn/project';

import { build, ensure, override } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';

import type { Opts } from '../options';
import { serialize, getProject, loadAppAuthConfig } from './util';

// TODO need to implement these
type Config = {
  requireConfirmation?: boolean; // alias to y maybe
  dryRun?: boolean;
};

export type FetchOptions = Required<
  Pick<
    Opts,
    | 'apiKey'
    | 'beta'
    | 'command'
    | 'confirm'
    | 'endpoint'
    | 'env'
    | 'log'
    | 'logJson'
    | 'outputPath'
    | 'projectId'
    | 'workspace'
  >
>;

const options = [
  o.apikey,
  o.beta,
  o.beta,
  o.configPath,
  o.endpoint,
  o.env,
  o.log,
  override(o.outputPath, {
    description: 'Path to output the fetched project to',
  }),
  o.logJson,
  o.workspace,
  o.snapshots,
  o.statePath,
];

const command: yargs.CommandModule<FetchOptions> = {
  command: 'fetch [projectId]',
  describe: `Fetch a project's state and spec from a Lightning Instance to the local state file without expanding to the filesystem.`,
  builder: (yargs: yargs.Argv<FetchOptions>) =>
    build(options, yargs)
      .positional('projectId', {
        describe:
          'The id of the project that should be fetched, should be a UUID',
        demandOption: true,
      })
      .example(
        'fetch 57862287-23e6-4650-8d79-e1dd88b24b1c',
        'Fetch an updated copy of a the above spec and state from a Lightning Instance'
      ),
  handler: ensure('project-fetch', options),
};

export default command;

export const handler = async (options: FetchOptions, logger: Logger) => {
  const commandPath = path.resolve(options.workspace ?? '.');
  const workspace = new Workspace(commandPath);

  const config = loadAppAuthConfig(options, logger);

  const { data } = await getProject(logger, config, options.projectId);
  const name = options.env || 'project';

  const project = await Project.from(
    'state',
    data,
    {
      endpoint: config.endpoint,
      env: name,
    },
    workspace.getConfig()
  );

  // TODO load whatever is on disk and compare it
  // If they have diverged, throw an error
  // Also, log whether we are updating or doing nothing

  const outputRoot = path.resolve(options.outputPath || '.');

  const projectFileName = project.getIdentifier();

  const projectsDir = project.config.dirs.projects ?? '.projects';

  const ext = path.extname(options.outputPath).substring(1) || undefined;

  const stateOutputPath = ext
    ? options.outputPath
    : `${outputRoot}/${projectsDir}/${projectFileName}`;

  const finalOutput = await serialize(project, stateOutputPath, ext as any);

  logger.success(`Fetched project file to ${finalOutput}`);
};
