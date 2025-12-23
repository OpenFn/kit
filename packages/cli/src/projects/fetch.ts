import yargs from 'yargs';
import path from 'node:path';
import Project, { Workspace } from '@openfn/project';

import { build, ensure, override } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';
import * as po from './options';

import type { Opts } from './options';
import { serialize, getProject, loadAppAuthConfig } from './util';

// TODO need to implement these
// type Config = {
//   requireConfirmation?: boolean; // alias to y maybe
//   dryRun?: boolean;
// };

export type FetchOptions = Pick<
  Opts,
  | 'alias'
  | 'apiKey'
  | 'command'
  | 'endpoint'
  | 'env'
  | 'force'
  | 'log'
  | 'logJson'
  | 'snapshots'
  | 'outputPath'
  | 'projectId'
  | 'workspace'
>;

const options = [
  po.alias,
  o.apikey,
  o.endpoint,
  o.log,
  o.logJson,
  o.snapshots, // TODO need to add support for this
  override(o.force, {
    description: 'Overwrite local file contents with the fetched contents',
  }),

  po.outputPath,
  po.env,
  po.workspace,
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
  const workspacePath = path.resolve(options.workspace ?? process.cwd());
  const workspace = new Workspace(workspacePath);
  const { projectId, outputPath, alias } = options;

  const config = loadAppAuthConfig(options, logger);
  logger.debug(
    `Fetching project ${projectId} as alias ${alias} from ${config.endpoint}`
  );

  const { data } = await getProject(logger, config, projectId!);

  const project = await Project.from(
    'state',
    data!,
    {
      endpoint: config.endpoint,
    },
    { ...workspace.getConfig(), alias }
  );

  logger.debug(
    `Loaded project with id ${project.id} and alias ${project.alias}`
  );

  // Work out where and how to serialize the project
  const outputRoot = path.resolve(outputPath || workspacePath);
  const projectsDir = project.config.dirs.projects ?? '.projects';
  const finalOutputPath =
    outputPath ?? `${outputRoot}/${projectsDir}/${project.qname}`;
  let format: undefined | 'json' | 'yaml' = undefined;

  if (outputPath) {
    // If the user gave us a path for output, we need to respect the format we've been given
    const ext = path.extname(outputPath!).substring(1) as any;
    if (ext.length) {
      format = ext;
    }
  }

  // See if a project already exists there
  const finalOutput = await serialize(
    project,
    finalOutputPath!,
    format,
    true // dry run - this won't trigger an actual write!
  );

  // If a project already exists at the output path, make sure it's compatible
  let current: Project | null = null;
  try {
    current = await Project.from('path', finalOutput);

    const hasAnyHistory = project.workflows.find(
      (w) => w.workflow.history?.length
    );

    // Skip version checking if:
    const skipVersionCheck =
      options.force || // The user forced the checkout
      !current || // there is no project on disk
      !hasAnyHistory; // the remote project has no history (can happen in old apps)

    if (!skipVersionCheck && !project.canMergeInto(current!)) {
      // TODO allow rename
      throw new Error('Error! An incompatible project exists at this location');
    }
  } catch (e) {
    // Do nothing - project doesn't exist
  }

  // TODO report whether we've updated or not

  // finally, write it!
  await serialize(project, finalOutputPath!, format as any);

  logger.success(`Fetched project file to ${finalOutput}`);

  return project;
};
