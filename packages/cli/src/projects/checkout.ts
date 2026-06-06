import yargs from 'yargs';
import Project, { Workspace } from '@openfn/project';
import path from 'path';
import fs from 'fs';
import { rimraf } from 'rimraf';

import { ensure, build } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';
import * as po from './options';

import type { Opts } from './options';
import {
  findLocallyChangedWorkflows,
  tidyWorkflowDir,
  updateForkedFrom,
} from './util';
import { createProjectCredentials } from './create-credentials';
import abort from '../util/abort';

export type CheckoutOptions = Pick<
  Opts,
  | 'command'
  | 'project'
  | 'workspace'
  | 'log'
  | 'clean'
  | 'force'
  | 'createCredentials'
>;

const options = [o.log, po.workspace, po.clean, o.force, po.creds];

const command: yargs.CommandModule = {
  command: 'checkout <project>',
  describe: 'Switch to a different OpenFn project in the same workspace',
  handler: ensure('project-checkout', options),
  builder: (yargs) =>
    build(options, yargs).positional('project', {
      describe: 'The id, alias or UUID of the project to checkout',
      demandOption: true,
    }),
};

export default command;

export const handler = async (options: CheckoutOptions, logger?: Logger) => {
  const projectIdentifier = options.project!;
  const workspacePath = options.workspace ?? process.cwd();
  const workspace = new Workspace(workspacePath, logger);

  // get the config
  // TODO: try to retain the endpoint for the projects
  const { project: _, ...config } = workspace.getConfig() as any;

  const currentProject = await workspace.getCheckedOutProject();
  // get the project
  let switchProject;
  if (/\.(yaml|json)$/.test(projectIdentifier)) {
    // TODO: should we allow checkout into an arbitrary folder?
    const filePath = projectIdentifier.startsWith('/')
      ? projectIdentifier
      : path.join(workspacePath, projectIdentifier);
    logger?.debug('Loading project from path ', filePath);
    switchProject = await Project.from('path', filePath, config);
  } else {
    switchProject = workspace.get(projectIdentifier);
  }

  if (!switchProject) {
    throw new Error(
      `Project with id ${projectIdentifier} not found in the workspace`
    );
  }
  logger?.info(`Checking out ${switchProject.alias}`);

  // get the current state of the checked out project
  try {
    const localProject = await Project.from('fs', {
      root: options.workspace || '.',
    });
    logger?.info(
      `Loaded currently checked out project ${localProject.alias} to check for divergence`
    );
    const changed = await findLocallyChangedWorkflows(
      workspace,
      localProject,
      'assume-ok'
    );
    if (changed.length && !options.force) {
      const err = {
        details: `Changes may be lost by checking out ${localProject.alias} right now`,
        // TODO how can users save changes? Not really possible right now
        fix: 'Pass --force or -f to override this warning and continue',
      };
      abort(
        logger!,
        `${switchProject.alias} has diverged from ${localProject.alias}!`,
        err
      );
    }
  } catch (e: any) {
    if (e.message.match('ENOENT')) {
      logger?.debug('No openfn.yaml found locally: skipping divergence test');
    } else {
      throw e;
    }
  }
  // Check whether the checked out project has diverged from its forked from versions

  // delete workflow dir before expanding project
  if (options.clean) {
    await rimraf(workspace.workflowsPath);
  } else {
    await tidyWorkflowDir(currentProject, switchProject, false, workspacePath);
  }

  // write the forked from map
  updateForkedFrom(switchProject);

  // expand project into directory
  const files: any = switchProject.serialize('fs');
  for (const f in files) {
    if (files[f]) {
      fs.mkdirSync(path.join(workspacePath, path.dirname(f)), {
        recursive: true,
      });
      fs.writeFileSync(path.join(workspacePath, f), files[f]);
    } else {
      logger?.warn('WARNING! No content for file', f);
    }
  }
  if (options.createCredentials) {
    createProjectCredentials(workspacePath, switchProject, logger);
  }

  logger?.success(`Expanded project to ${workspacePath}`);
};
