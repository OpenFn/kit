import yargs from 'yargs';
import Project, { Workspace } from '@openfn/project';
import path from 'node:path';
import fs from 'node:fs/promises';

import { ensure, build, override } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';
import * as po from './options';

import type { Opts } from './options';
import { handler as checkout } from './checkout';

export type MergeOptions = Required<
  Pick<
    Opts,
    'command' | 'project' | 'workspace' | 'removeUnmapped' | 'workflowMappings'
  >
> &
  Pick<Opts, 'log' | 'force' | 'outputPath'> & { source?: string };

const options = [
  po.removeUnmapped,
  po.workflowMappings,
  po.workspace,
  o.log,
  // custom output because we don't want defaults or anything
  {
    // TODO presumably if we do this we don't also checkout?
    name: 'output-path',
    yargs: {
      alias: 'o',
      description:
        'Optionally write the merged project file to a custom location',
    },
  },
  {
    name: 'source',
    yargs: {
      alias: 's',
      description:
        'Path to the source state file to merge from (defaults to the currently checked out project)',
    },
  },
  override(o.force, {
    description: 'Force a merge even when workflows are incompatible',
  }),
];

const command: yargs.CommandModule = {
  command: 'merge <project>',
  describe:
    'Merges the currently checked out project into the specified target project (by UUID, id or alias)',
  handler: ensure('project-merge', options),
  builder: (yargs) => build(options, yargs),
};

export default command;

export const handler = async (options: MergeOptions, logger: Logger) => {
  const workspacePath = options.workspace;
  const workspace = new Workspace(workspacePath);
  if (!workspace.valid) {
    logger.error('Command was run in an invalid openfn workspace');
    return;
  }

  let sourceProject: Project;
  if (options.source) {
    const sourcePath = path.resolve(options.source);
    logger.debug('Loading source project from path', sourcePath);
    sourceProject = await Project.from('path', sourcePath);
  } else {
    sourceProject = workspace.getActiveProject()!;
    if (!sourceProject) {
      logger.error(`No project currently checked out`);
      return;
    }
    logger.debug(`Loading source project from workspace (${sourceProject.id})`);
  }

  const targetProjectIdentifier = options.project;

  // Lookup the target project - the thing we are merging into
  let targetProject;
  if (/\.(ya?ml|json)$/.test(targetProjectIdentifier)) {
    const filePath = path.join(workspacePath, targetProjectIdentifier);
    logger.debug('Loading target project from path ', filePath);
    targetProject = await Project.from('path', filePath);
  } else {
    logger.debug(
      `Loading target project from workspace ${targetProjectIdentifier}`
    );
    targetProject = workspace.get(targetProjectIdentifier);
  }
  if (!targetProject) {
    logger.error(
      `Project "${targetProjectIdentifier}" not found in the workspace`
    );
    return;
  }

  if (targetProject.id === sourceProject.id) {
    logger.error('Merging into the same project not allowed');
    return;
  }

  if (!targetProject.id) {
    logger.error('The target project has no id');
    return;
  }
  const finalPath =
    options.outputPath ?? workspace.getProjectPath(targetProject.id);
  if (!finalPath) {
    logger.error('Path to target project not found.');
    return;
  }
  const final = Project.merge(sourceProject, targetProject, {
    removeUnmapped: options.removeUnmapped,
    workflowMappings: options.workflowMappings,
    force: options.force,
  });

  let outputFormat = workspace.config!.formats.project;
  // If outputPath has a JSON file extension, use that
  if (options.outputPath?.endsWith('.json')) {
    outputFormat = 'json';
  } else if (options.outputPath?.endsWith('.yaml')) {
    outputFormat = 'yaml';
  }

  let finalState = final.serialize('state', {
    format: outputFormat,
  });
  if (outputFormat === 'json') {
    finalState = JSON.stringify(finalState, null, 2);
  }
  await fs.writeFile(finalPath, finalState as string);

  logger.info(`Updated statefile at `, finalPath);

  logger.info('Checking out merged project to filesystem');

  // TODO support --no-checkout to merge without expanding

  // Checkout after merge to expand updated files into filesystem
  await checkout(
    {
      workspace: workspacePath,
      project: options.outputPath ? finalPath : final.id,
      log: options.log,
    },
    logger
  );

  logger.success(
    `Project ${sourceProject.id} has been merged into Project ${targetProject.id}`
  );
};
