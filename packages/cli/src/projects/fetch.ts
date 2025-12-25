import yargs from 'yargs';
import path from 'node:path';
import Project, { Workspace } from '@openfn/project';

import resolvePath from '../util/resolve-path';
import { build, ensure, override } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';
import * as po from './options';

import type { Opts } from './options';
import { serialize, fetchProject, loadAppAuthConfig } from './util';

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
  | 'project'
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
  command: 'fetch [project]',
  describe: `Download the latest version of a project from a lightning server (does not expand the project, use checkout)`,
  builder: (yargs: yargs.Argv<FetchOptions>) =>
    build(options, yargs)
      .positional('project', {
        describe:
          'The id, alias or UUID of the project to fetch. If not set, will default to the active project',
      })
      .example(
        'fetch 57862287-23e6-4650-8d79-e1dd88b24b1c',
        'Fetch an updated copy of a the above spec and state from a Lightning Instance'
      ),
  handler: ensure('project-fetch', options),
};

export default command;

const printProjectName = (project: Project) =>
  `${project.qname} (${project.id})`;

export const handler = async (options: FetchOptions, logger: Logger) => {
  const workspacePath = options.workspace ?? process.cwd();
  logger.debug('Using workspace at', workspacePath);

  const workspace = new Workspace(workspacePath, logger, false);
  const { project: projectIdentifier, outputPath } = options;
  let { alias = 'main' } = options;
  const config = loadAppAuthConfig(options, logger);
  let localProject;

  // first we see if this project exists locally
  logger.debug('Checking for local copy of project...');
  if (projectIdentifier) {
    localProject = workspace.get(projectIdentifier);

    if (!localProject) {
      logger.debug(`Project ${projectIdentifier} not found locally`);
      // whatever the user passed could not be found
      // actually, if its not local,it still might exist remotely
      // process.exit(1);
    } else {
      alias = localProject.alias;
      logger.debug(`Found local project`, printProjectName(localProject));
    }
  } else {
    logger.debug(
      'Project identifier not provided. Looking up active project in working dir...'
    );
    localProject = workspace.get(workspace.activeProject?.id as string);
    if (localProject) {
      logger.debug('Active project found!', printProjectName(localProject)); // todo id? uuid?
      logger.info('Will fetch latest', printProjectName(localProject));
      alias = localProject.alias;
    } else {
      // TOOD maybe advice passing a project id eh?
      logger.error('Failed to find local project in working directory');
      logger.error(
        'Pass a project UUID, id or alias to set which project to fetch'
      );
      process.exit(1);
    }
  }

  // Note: when fetching, we must ALWAYS use the local endpoint
  // if we're fetching from a local project
  // otherwise, all the UUIDs and stuff will be wrong
  // This is a wierd case when we ignore the endpoint passed by the user
  const projectEndpoint = localProject?.openfn?.endpoint ?? config.endpoint;
  const projectUUID = (localProject?.uuid ?? projectIdentifier) as string;

  logger.debug(
    `Fetching project with UUID ${projectUUID} from ${projectEndpoint}`
  );
  logger.debug('Using local alias', alias);

  const { data } = await fetchProject(
    projectEndpoint,
    config.apiKey,
    projectUUID,
    logger
  );

  const project = await Project.from(
    'state',
    data!,
    {
      endpoint: projectEndpoint,
    },
    {
      ...workspace.getConfig(),
      alias,
    }
  );

  logger.debug(
    `Loaded project with id ${project.id} and alias ${project.alias}`
  );

  // Work out where and how to serialize the project
  const outputRoot = resolvePath(outputPath || workspacePath);
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

    if (options.alias) {
      logger.warn(
        `WARNING: alias "${options.alias}" was set, but will be ignored as output path was provided`
      );
    }
  }

  if (localProject) {
    if (!options.force && localProject.uuid != project.uuid) {
      // TODO make this prettier in output
      const error: any = new Error('PROJECT_EXISTS');
      error.message = 'A project with a different UUID exists at this location';
      error.fix = `You have tried to fetch a remote project into a local project with a different UUID

Try adding an alias to rename the new project:

      openfn fetch ${project} --alias ${project.id}

To ignore this error and override the local file, pass --force (-f)

    openfn fetch ${project} --force
`;
      error.fetched_project = {
        uuid: project.uuid,
        id: project.id,
        alias: project.alias,
      };
      error.local_project = {
        uuid: localProject.uuid,
        id: localProject.id,
        alias: localProject.alias,
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
      !hasAnyHistory; // the remote project has no history (can happen in old apps)

    if (!skipVersionCheck && !project.canMergeInto(localProject!)) {
      // TODO allow rename
      throw new Error('Error! An incompatible project exists at this location');
    }
  }

  // TODO report whether we've updated or not

  // finally, write it!
  await serialize(project, finalOutputPath!, format as any);

  logger.success(
    `Fetched project file to ${finalOutputPath}.${format ?? 'yaml'}`
  );

  return project;
};
