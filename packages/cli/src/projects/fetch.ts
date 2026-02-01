import yargs from 'yargs';
import path from 'node:path';
import Project, { Workspace } from '@openfn/project';

import { build, ensure, override } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';
import * as po from './options';

import type { Opts } from './options';
import {
  serialize,
  fetchProject,
  loadAppAuthConfig,
  getSerializePath,
} from './util';
import { writeFile } from 'node:fs/promises';

export type FetchOptions = Pick<
  Opts,
  | 'alias'
  | 'apiKey'
  | 'command'
  | 'endpoint'
  | 'env'
  | 'force'
  | 'format'
  | 'log'
  | 'logJson'
  | 'snapshots'
  | 'outputPath'
  | 'project'
  | 'workspace'
>;

const options = [
  po.alias,
  o.apiKey,
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
  po.format,
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

const fetchV1 = async (options: FetchOptions, logger: Logger) => {
  const workspacePath = options.workspace ?? process.cwd();
  logger.debug('Using workspace at', workspacePath);

  const workspace = new Workspace(workspacePath, logger, false);
  // TODO we may need to resolve an alias to a UUID and endpoint
  const localProject = workspace.get(options.project!);
  if (localProject) {
    logger.debug(
      `Resolved "${options.project}" to local project ${printProjectName(
        localProject
      )}`
    );
  } else {
    logger.debug(
      `Failed to resolve "${options.project}" to local project. Will send request to app anyway.`
    );
  }

  const config = loadAppAuthConfig(options, logger);

  const { data } = await fetchProject(
    options.endpoint ?? localProject?.openfn?.endpoint!,
    config.apiKey,
    localProject?.uuid ?? options.project!,
    logger
  );

  const finalOutputPath = getSerializePath(
    localProject!,
    options.workspace,
    options.outputPath
  );

  logger.success(`Fetched project file to ${finalOutputPath}`);
  await writeFile(finalOutputPath, JSON.stringify(data, null, 2));

  // TODO should we return a Project or just the raw state?
  return data;
};

export const handler = async (options: FetchOptions, logger: Logger) => {
  if (options.format === 'state') {
    return fetchV1(options, logger);
  }
  return fetchV2(options, logger);
};

export const fetchV2 = async (options: FetchOptions, logger: Logger) => {
  const workspacePath = options.workspace ?? process.cwd();
  logger.debug('Using workspace at', workspacePath);

  const workspace = new Workspace(workspacePath, logger, false);
  const { outputPath } = options;

  const remoteProject = await fetchRemoteProject(workspace, options, logger);

  if (!options.force && options.format !== 'state') {
    const localTargetProject = await resolveOutputProject(
      workspace,
      options,
      logger
    );

    ensureTargetCompatible(options, remoteProject, localTargetProject);
  }

  // Work out where and how to serialize the project
  const finalOutputPath = getSerializePath(
    remoteProject,
    workspacePath,
    outputPath
  );

  let format: undefined | 'json' | 'yaml' | 'state' = options.format;
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

  // TODO report whether we've updated or not

  // finally, write it!
  const finalPathWithExt = await serialize(
    remoteProject,
    finalOutputPath!,
    format as any
  );

  logger.success(`Fetched project file to ${finalPathWithExt}`);

  return remoteProject;
};

// Work out the existing target project, if any, to fetch to
async function resolveOutputProject(
  workspace: Workspace,
  options: FetchOptions,
  logger: Logger
) {
  logger.debug('Checking for local copy of project...');

  // If the user is writing to an explicit path,
  // check to see i fanything exists there
  if (options.outputPath) {
    try {
      const customProject = await Project.from('path', options.outputPath);
      logger.debug(
        `Found existing local project ${printProjectName(customProject)} at`,
        options.outputPath
      );
      return customProject;
    } catch (e) {
      logger.debug('No project found at', options.outputPath);
    }
  }
  // if an alias is specified, we use that as the output
  if (options.alias) {
    const aliasProject = workspace.get(options.alias);
    if (aliasProject) {
      logger.debug(
        `Found local project from alias:`,
        printProjectName(aliasProject)
      );
      return aliasProject;
    } else {
      logger.debug(`No local project found with alias ${options.alias}`);
    }
  }

  // Otherwise we try and resolve to the projcet identifier to something in teh workspace
  const project = workspace.get(options.project!);
  if (project) {
    logger.debug(
      `Found local project from identifier:`,
      printProjectName(project)
    );
    return project;
  } else {
    logger.debug(
      `No local project found matching identifier: `,
      options.project
    );
  }
}

// This will fetch the remote project the user wants

export async function fetchRemoteProject(
  workspace: Workspace,
  options: FetchOptions,
  logger: Logger
) {
  logger.debug(`Fetching latest project data from app`);

  const config = loadAppAuthConfig(options, logger);

  let projectUUID: string = options.project!;

  // First, we need to see if the project argument, which might be a UUID, id or alias,
  // resolves to anything
  const localProject = workspace.get(options.project!);
  if (
    localProject?.openfn?.uuid &&
    localProject.openfn.uuid !== options.project
  ) {
    // if we resolve the UUID to something other than what the user gave us,
    // debug-log the UUID we're actually going to use
    projectUUID = localProject.openfn.uuid as string;
    logger.debug(
      `Resolved ${
        options.project
      } to UUID ${projectUUID} from local project ${printProjectName(
        localProject
      )}`
    );
  }

  const projectEndpoint = localProject?.openfn?.endpoint ?? config.endpoint;

  const { data } = await fetchProject(
    projectEndpoint,
    config.apiKey,
    projectUUID,
    logger
  );
  console.log(data.workflows);

  const project = await Project.from(
    'state',
    data!,
    {
      endpoint: projectEndpoint,
    },
    {
      ...workspace.getConfig(),
      alias: options.alias ?? localProject?.alias ?? 'main',
    }
  );

  console.log(project.workflows[0].history);

  logger.debug(
    `Loaded remote project ${project.openfn!.uuid} with id ${
      project.id
    } and alias ${project.alias}`
  );
  return project;
}

function ensureTargetCompatible(
  options: FetchOptions,
  remoteProject: Project,
  localProject?: Project
) {
  if (localProject) {
    if (!options.force && localProject.uuid != remoteProject.uuid) {
      // TODO make this prettier in output
      const error: any = new Error('PROJECT_EXISTS');
      error.message = 'A project with a different UUID exists at this location';
      error.fix = `You have tried to fetch a remote project into a local project with a different UUID

Try adding an alias to rename the new project:

      openfn fetch ${options.project} --alias ${remoteProject.id}

To ignore this error and override the local file, pass --force (-f)

    openfn fetch ${options.project} --force
`;
      error.fetched_project = {
        uuid: remoteProject.uuid,
        id: remoteProject.id,
        alias: remoteProject.alias,
      };
      error.local_project = {
        uuid: localProject.uuid,
        id: localProject.id,
        alias: localProject.alias,
      };
      delete error.stack;

      throw error;
    }
  }
}
