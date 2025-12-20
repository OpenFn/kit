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
  // TODO we use serialize the generate the path, but
  // there should be an easier way really?
  const finalOutput = await serialize(
    project,
    finalOutputPath!,
    format,
    true // dry run - this won't trigger an actual write!
  );

  // If a project already exists at the output path, make sure it's compatible
  let current: Project | null = null;
  try {
    // TODO when project.from fails, throw a clear error like NOT_FOUND
    current = await Project.from('path', finalOutput);

    // Make sure that the local project has a matching UUID
    // otherwise something must be wrong!
    if (!options.force && current.uuid != project.uuid) {
      // TODO make this prettier in output
      const error: any = new Error('PROJECT_EXISTS');
      error.message = 'A project with a different UUID exists at this location';
      error.fix = `You have tried to fetch a remote project into a local project with a different UUID

Try adding an alias to rename the new project:

      openfn fetch ${projectId} --alias ${project.id}

To ignore this error and override the local file, pass --force (-f)

    openfn fetch ${projectId} --force
`;
      error.fetched_project = {
        uuid: project.uuid,
        id: project.id,
        alias: project.alias,
      };
      error.local_project = {
        uuid: current.uuid,
        id: current.id,
        alias: current.alias,
      };
      delete error.stack;
      logger.error(error);

      // TODO maybe it's not right to exit early
      // but it'll do until I can resolve these errors
      process.exit(1);
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
      // TODO allow rename
      throw new Error('Error! An incompatible project exists at this location');
    }
  } catch (e) {
    // console.log(e);
    // Do nothing - project doesn't exist
  }

  // TODO report whether we've updated or not

  // finally, write it!
  await serialize(project, finalOutputPath!, format as any);

  logger.success(`Fetched project file to ${finalOutput}`);

  return project;
};
