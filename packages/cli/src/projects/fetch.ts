import yargs from 'yargs';
import path from 'node:path';
import Project, { Workspace } from '@openfn/project';

import { build, ensure, override } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';

import type { Opts } from '../options';
import { serialize, getProject, loadAppAuthConfig } from './util';

// TODO need to implement these
// type Config = {
//   requireConfirmation?: boolean; // alias to y maybe
//   dryRun?: boolean;
// };

export type FetchOptions = Pick<
  Opts,
  | 'apiKey'
  | 'command'
  | 'endpoint'
  | 'env'
  | 'force'
  | 'log'
  | 'logJson'
  | 'outputPath'
  | 'projectId'
  | 'workspace'
>;

const options = [
  o.apikey,
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
  override(o.force, {
    description: 'Overwrite local file contents with the fetched contents',
  }),
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
  const workspacePath = path.resolve(options.workspace ?? '.');
  const workspace = new Workspace(workspacePath);
  const projectId = options.projectId!;

  const outputPath = options.outputPath;

  const config = loadAppAuthConfig(options, logger);

  const { data } = await getProject(logger, config, projectId);
  const name = options.env || 'project';

  const project = await Project.from(
    'state',
    data!,
    {
      endpoint: config.endpoint,
      env: name,
    },
    workspace.getConfig()
  );

  // Work out where and how to serialize the project
  const outputRoot = path.resolve(options.outputPath || workspacePath);
  const projectFileName = project.getIdentifier();
  const projectsDir = project.config.dirs.projects ?? '.projects';
  let ext = path.extname(outputPath!).substring(1);
  let format: undefined | 'json' | 'yaml' = undefined;
  if (ext.length) {
    format = ext as any;
  }

  const stateOutputPath = ext
    ? outputPath
    : `${outputRoot}/${projectsDir}/${projectFileName}`;

  // See if a project already exists there
  const finalOutput = await serialize(
    project,
    stateOutputPath!,
    format,
    true // dry run - this won't trigger an actual write!
  );

  // If a project already exists at the output path, make sure it's compatible
  let current: Project | null = null;
  try {
    current = await Project.from('path', finalOutput);
  } catch (e) {
    // Do nothing - project doesn't exist
  }

  const hasAnyHistory = project.workflows.find(
    (w) => w.workflow.history?.length
  );

  // Skip version checking if:
  const skipVersionCheck =
    options.force || // The user forced the checkout
    !current || // there is no project on disk
    !hasAnyHistory; // the remote project has no history (can happen in old apps)

  if (!skipVersionCheck && !project.canMergeInto(current!)) {
    // TODO allow force or rename
    throw new Error('Error! An incompatible project exists at this location');
  }

  // TODO report whether we've updated or not

  // finally, write it!
  await serialize(project, stateOutputPath!, format as any);

  logger.success(`Fetched project file to ${finalOutput}`);

  return project;
};
