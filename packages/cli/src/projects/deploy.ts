// beta v2 version of CLI deploy

/**
 * New plan for great glory
 *
 * - from('fs') does NOT take project file into account
 * - deploy must first fetch (and ensure no conflcits)
 * - deploy must then load the project from disk
 * - deploy must then merge into that project
 * - then call provisioner
 * - finally write to disk
 *
 *
 * PLUS: diff summary (changed workflows and steps)
 * PLUS: confirm
 * PLUS: dry run
 *
 *
 *
 * One possible probllem for deploy
 *
 * The idea is we fetch the latest server version,
 * write that to disk, merge our changes, and push
 *
 * But what if our project file is ahead of the server? A fetch
 * will conflict and we don't want to throw.
 *
 * The project may be ahead because: a), we checked out another branch
 * and stashed changes, b) we can ran some kind of reconcilation/merge,
 * c) we did a manual export (take my fs and write it to the project)
 *
 * So basically when fetching, we need to check for divergence in history.
 * When fetching, for each workflow, we need to decide whether to keep or reject the
 * server version based on the history.
 *
 *
 *
 * This is super complex and we're getting into merge territory
 * First priority is: if there's a problem (that's a super difficult thing!) warn the user
 * Second priority is: help the user resolve it
 *
 *
 * The local project files are giving me a headache. But we should be strict and say:
 * the project is ALWAYS a representation of the remote. It is invalid for that project
 * to represent the local system
 *
 * So this idea that I can "save" the local to the project file is wrong
 * The idea thatwhen I checkout, I "stash" to a project file is wrong
 *
 * I should be able to export a project to any arbitrary file, yes
 * And when checking out and there are conflicts, I should be able to create a duplicate
 * file to save my changes without git.
 * I think that means checkout errors (it detects changes will be lost), but you have the option to
 * stash a temporary local project to be checkedout later
 *
 *
 * This clarify and strictness will I think really help
 *
 * So: the local project is NEVER ahead of the server
 * (but what if the user edited it and it is? I think the system igores it and that's just a force push)
 */

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
  | 'workspace'
>;

const options = [
  // local options
  o2.env,
  o2.workspace,

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

  const diffs = reportDiff(remoteProject, localProject, logger);
  if (!diffs.length) {
    logger.success('Nothing to deploy');
    return;
  }

  // Ensure there's no divergence
  if (!localProject.canMergeInto(remoteProject)) {
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
  const merged = Project.merge(localProject, remoteProject, { force: true });
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

  logger.info('Sending project to app...');

  await deployProject(config.endpoint, config.apiKey, state, logger);

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
