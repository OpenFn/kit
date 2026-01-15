import yargs from 'yargs';
import Project from '@openfn/project';
import c from 'chalk';

import { handler as fetch } from './fetch';
import * as o from '../options';
import * as o2 from './options';
import {
  loadAppAuthConfig,
  deployProject,
  fetchProject,
  serialize,
  getSerializePath,
} from './util';
import { build, ensure } from '../util/command-builders';

import type { Provisioner } from '@openfn/lexicon/lightning';
import type { Logger } from '../util/logger';
import type { Opts } from '../options';

export type DeployOptions = Pick<
  Opts,
  | 'apiKey'
  | 'command'
  | 'confirm'
  | 'endpoint'
  | 'force'
  | 'log'
  | 'logJson'
  | 'confirm'
> & { workspace?: string; dryRun?: boolean };

const options = [
  // local options
  o2.env,
  o2.workspace,
  o2.dryRun,

  // general options
  o.apiKey,
  o.endpoint,
  o.log,
  o.logJson,
  o.snapshots,
  o.force,
  o.confirm,
];

const printProjectName = (project: Project) =>
  `${project.id} (${project.openfn?.uuid || '<no UUID>'})`;

export const command: yargs.CommandModule<DeployOptions> = {
  command: 'deploy',
  describe: `Deploy the checked out project to a Lightning Instance`,
  builder: (yargs: yargs.Argv<DeployOptions>) =>
    build(options, yargs)
      .positional('project', {
        describe:
          'The UUID, local id or local alias of the project to deploy to',
      })
      .example(
        'deploy',
        'Deploy the checkout project to the connected instance'
      ),
  handler: ensure('project-deploy', options),
};

export async function handler(options: DeployOptions, logger: Logger) {
  const config = loadAppAuthConfig(options, logger);

  // TODO: allow users to specify which project to deploy
  // Should be able to take any project.yaml file via id, uuid, alias or path
  // Note that it's a little wierd to deploy a project you haven't checked out,
  // so put good safeguards here
  logger.info('Attempting to load checked-out project from workspace');
  const localProject = await Project.from('fs', {
    root: options.workspace || '.',
  });

  // TODO if there's no local metadata, the user must pass a UUID or alias to post to

  logger.success(`Loaded local project ${printProjectName(localProject)}`);
  // First step, fetch the latest version and write
  // this may throw!
  let remoteProject: Project;
  try {
    const { data } = await fetchProject(
      config.endpoint,
      config.apiKey,
      localProject.uuid ?? localProject.id,
      logger
    );

    remoteProject = await Project.from('state', data!, {
      endpoint: config.endpoint,
    });

    logger.success('Downloaded latest version of project at ', config.endpoint);
  } catch (e) {
    console.log(e);
    throw e;
    // If fetch failed because of compatiblity with the local project, what do we do?
    // Well, actually I don't think I want this fetch to write to disk yet
    // So if force is passed, we merge and write it anyway
    // otherwise we throw because we've diverged
    // this will actually happen later
  }

  // warn if the remote UUID is different to the local UUID
  // This shouldn't happen?
  if (!options.force && localProject.uuid !== remoteProject.uuid) {
    logger.error(`UUID conflict!

Your local project (${localProject.uuid}) has a different UUID to the remote project (${remoteProject.uuid}).

Pass --force to override this error and deploy anyway.`);
    return false;
  }

  const diffs = reportDiff(remoteProject!, localProject, logger);
  if (!diffs.length) {
    logger.success('Nothing to deploy');
    return;
  }

  // Ensure there's no divergence
  if (!localProject.canMergeInto(remoteProject!)) {
    if (!options.force) {
      logger.error(`Error: Projects have diverged!

The remote project has been edited since the local project was branched. Changes may be lost.

Pass --force to override this error and deploy anyway.`);
      return;
    }
  }

  logger.info(
    'Remote project has not diverged from local project - it is safe to deploy 🎉'
  );

  // TODO I think we now gotta merge local into the remote, because
  // when we deploy we want to keep all the remote metadata

  // TODO the only difficulty I see with this is: what if the user makes
  // a project change locally? It'll a) diverge and b) get ignored
  // So that needs thinking about

  logger.info('Merging changes into remote project');
  const merged = Project.merge(localProject, remoteProject!, {
    mode: 'replace',
    force: true,
  });
  // generate state for the provisioner
  const state = merged.serialize('state', {
    format: 'json',
  }) as Provisioner.Project_v1;

  // TODO only do this if asked
  // or maybe write it to output with -o?
  // maybe we can write state.app, state.local and state.result
  // this is heavy debug stuff
  logger.debug('Converted merged local project to app state:');
  logger.debug(JSON.stringify(state, null, 2));

  // TODO not totally sold on endpoint handling right now
  config.endpoint ??= localProject.openfn?.endpoint!;

  if (options.dryRun) {
    logger.always('dryRun option set: skipping upload step');
  } else {
    if (options.confirm) {
      if (
        !(await logger.confirm(
          `Ready to deploy changes to ${config.endpoint}?`
        ))
      ) {
        logger.always('Cancelled deployment');
        return false;
      }
    }

    logger.info('Sending project to app...');

    const result = await deployProject(
      config.endpoint,
      config.apiKey,
      state,
      logger
    );

    // TODO do we think this final project is right?
    // We need to restore CLI stuff like alias, meta
    const finalProject = await Project.from(
      'state',
      result!,
      {
        endpoint: config.endpoint,
      },
      merged.config
    );
    console.log(finalProject);
    // TODO write the result back to the project file

    const finalOutputPath = getSerializePath(localProject, options.workspace!);
    logger.debug('Updating local project at ', finalOutputPath);
    await serialize(finalProject, finalOutputPath);
  }

  logger.success('Updated project at', config.endpoint);
}

export const reportDiff = (local: Project, remote: Project, logger: Logger) => {
  const diffs = remote.diff(local);

  if (diffs.length === 0) {
    logger.info('No workflow changes detected');
    return diffs;
  }

  const added = diffs.filter((d) => d.type === 'added');
  const changed = diffs.filter((d) => d.type === 'changed');
  const removed = diffs.filter((d) => d.type === 'removed');

  if (added.length > 0) {
    logger.break();
    logger.always(c.green('Workflows added:'));
    for (const diff of added) {
      logger.always(c.green(`  - ${diff.id}`));
    }
    logger.break();
  }

  if (changed.length > 0) {
    logger.break();
    logger.always(c.yellow('Workflows modified:'));
    for (const diff of changed) {
      logger.always(c.yellow(`  - ${diff.id}`));
    }
    logger.break();
  }

  if (removed.length > 0) {
    logger.break();
    logger.always(c.red('Workflows removed:'));
    for (const diff of removed) {
      logger.always(c.red(`  - ${diff.id}`));
    }
    logger.break();
  }

  return diffs;
};
