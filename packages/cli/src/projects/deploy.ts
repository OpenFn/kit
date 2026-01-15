import yargs from 'yargs';
import Project from '@openfn/project';

import { handler as fetch } from './fetch';
import * as o from '../options';
import * as o2 from './options';
import { loadAppAuthConfig, deployProject } from './util';
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
    remoteProject = await fetch(
      {
        ...options,
        // Prefer the UUID since it's most specific
        project: localProject.uuid ?? localProject.id,
      },
      logger
    );
    logger.success('Downloaded latest version of project at ', config.endpoint);
  } catch (e) {
    console.log(e);
    // If fetch failed because of compatiblity, what do we do?
    //
    // Basically we failed to write to the local project file
    // If -f is true, do we:
    // a) force-fetch the latest project
    // b) or force merge into the old project, and then force push?
    //
    // The file system may be in a real mess if fs, project and app are all diverged!
    // So I think we:
    // Log an error: the server has diverged from your local copy
    // Run fetch to resolve the conflict (it'll throw too!)
    // Pass -f to ignore your local project and pull the latest app changes
    // (changes shouldn't be lost here, because its the file system that's kind)
    //
    // Actually, the FS is king here.
    //
    // What if:
    // Locally I've changed workflow A
    // Remove has changed workflow B
    // I basically want to keep my workflow A changes and keep the workflow B changes
    // But if we force, we'll force our local workflow into the project, overriding it
    // Gods its complicated
    // What I think you actually want to do is:
    // force pull the remote version
    // merge only your changed workflows onto the remote
    // but merge doesn't work like that
    // So either I need merge to be able to merge the fs with a project (sort of like an expand-and-merge)
    // Or deploy should accept a list of workflows (only apply these workflows)
    // The problem with the deploy is that the local fs will still be out of date
    //
    // What about openfn project reconcile
    // This will fetch the remote project
    // check it out into your fs
    // any changed workflows you'll be promoted to:
    // - keep local
    // - keep app
    // - keep both
    // if keep both, two folders will be created. The user must manually merge
    // this leaves you with a file system that can either be merged, deployed or exported
  }

  // TODO warn if the remote UUID is different to the local UUID
  // That suggests you're doing something wrong!
  // force will suppress

  const diffs = reportDiff(remoteProject!, localProject, logger);
  if (!diffs.length) {
    logger.success('Nothing to deploy');
    return;
  }

  // Ensure there's no divergence
  if (!localProject.canMergeInto(remoteProject!)) {
    if (!options.force) {
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

  // // // hack! needs fixing
  // state.workflows['turtle-power'].lock_version =
  //   remoteProject.workflows[0].openfn?.lock_version;

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
    if (
      !(await logger.confirm(`Ready to deploy changes to ${config.endpoint}?`))
    ) {
      logger.always('Cancelled deployment');
      return false;
    }

    logger.info('Sending project to app...');

    await deployProject(config.endpoint, config.apiKey, state, logger);
    // TODO write the result back to the project file
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
    logger.info('Workflows added:');
    for (const diff of added) {
      logger.info(`  - ${diff.id}`);
    }
  }

  if (changed.length > 0) {
    logger.info('Workflows modified:');
    for (const diff of changed) {
      logger.info(`  - ${diff.id}`);
    }
  }

  if (removed.length > 0) {
    logger.info('Workflows removed:');
    for (const diff of removed) {
      logger.info(`  - ${diff.id}`);
    }
  }

  return diffs;
};
