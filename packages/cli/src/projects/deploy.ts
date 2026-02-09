import yargs from 'yargs';
import Project, { Workspace } from '@openfn/project';
import c from 'chalk';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import * as o from '../options';
import * as o2 from './options';
import {
  loadAppAuthConfig,
  deployProject,
  fetchProject,
  serialize,
  getSerializePath,
  updateForkedFrom,
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
  aliases: 'push',
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

export const hasRemoteDiverged = (
  local: Project,
  remote: Project
): string[] | null => {
  let diverged: string[] | null = null;

  const refs = local.cli.forked_from ?? {};

  // for each workflow, check that the local fetched_from is the head of the remote history
  for (const wf of local.workflows) {
    if (wf.id in refs) {
      const forkedVersion = refs[wf.id];
      const remoteVersion = remote.getWorkflow(wf.id)?.history.at(-1);
      console.log(
        `${wf.id}:  forked_from: ${forkedVersion}, remote: ${remoteVersion}`
      );
      if (forkedVersion !== remoteVersion) {
        diverged ??= [];
        diverged.push(wf.id);
      }
    } else {
      // TODO what if there's no forked from for this workflow?
      // Do we assume divergence because we don't know? Do we warn?
    }
  }

  // TODO what if a workflow is removed locally?

  return diverged;
};

export async function handler(options: DeployOptions, logger: Logger) {
  logger.warn(
    'WARNING: the project deploy command is in BETA and may not be stable. Use cautiously on production projects.'
  );
  const config = loadAppAuthConfig(options, logger);

  logger.info('Attempting to load checked-out project from workspace');

  // TODO this is the hard way to load the local alias
  // We need track alias in openfn.yaml to make this easier (and tracked in from fs)
  const ws = new Workspace(options.workspace || '.');
  const { alias } = ws.getActiveProject()!;
  // TODO this doesn't have an alias
  const localProject = await Project.from('fs', {
    root: options.workspace || '.',
    alias,
  });

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

  // TODO: what if remote diff and the version checked disagree for some reason?
  const diffs = reportDiff(localProject, remoteProject, logger);
  if (!diffs.length) {
    logger.success('Nothing to deploy');
    return;
  }

  // Ensure there's no divergence

  // Skip divergence testing if the remote has no history in its workflows
  // (this will only happen on older versions of lightning)
  // TODO now maybe skip if there's no forked_from
  const skipVersionTest =
    // localProject.workflows.find((wf) => wf.history.length === 0) ||
    remoteProject.workflows.find((wf) => wf.history.length === 0);

  // localProject.workflows.forEach((w) => console.log(w.history));

  if (skipVersionTest) {
    logger.warn(
      'Skipping compatibility check as no local version history detected'
    );
    logger.warn('Pushing these changes may overwrite changes made to the app');
  } else {
    const divergentWorkflows = hasRemoteDiverged(localProject, remoteProject!);
    if (divergentWorkflows) {
      logger.warn(
        `The following workflows have diverged: ${divergentWorkflows}`
      );
      if (!options.force) {
        logger.error(`Error: Projects have diverged!

  The remote project has been edited since the local project was branched. Changes may be lost.

  Pass --force to override this error and deploy anyway.`);
        return;
      } else {
        logger.warn(
          'Remote project has not diverged from local project! Pushing anyway as -f passed'
        );
      }
    } else {
      logger.info(
        'Remote project has not diverged from local project - it is safe to deploy 🎉'
      );
    }
  }

  logger.info('Merging changes into remote project');
  // TODO I would like to log which workflows are being updated
  const merged = Project.merge(localProject, remoteProject!, {
    mode: 'replace',
    force: true,
    onlyUpdated: true,
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

  // TODO: I want to report diff HERE, after the merged state and stuff has been built

  if (options.dryRun) {
    logger.always('dryRun option set: skipping upload step');
  } else {
    // sync summary
    // :+1: the remove project has not changed since last sync / the remote project has changed since last sync, and your changes may overwrite these
    // The following workflows will be updated

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

    const { data: result } = await deployProject(
      config.endpoint,
      config.apiKey,
      state,
      logger
    );

    // TODO do we think this final project is right?
    // We need to restore CLI stuff like alias, meta
    const finalProject = await Project.from(
      'state',
      result,
      {
        endpoint: config.endpoint,
      },
      merged.config
    );

    updateForkedFrom(finalProject);
    const configData = finalProject.generateConfig();
    await writeFile(
      path.resolve(options.workspace!, configData.path),
      configData.content
    );

    // TODO why is alias wrong here?
    const finalOutputPath = getSerializePath(localProject, options.workspace!);
    const fullFinalPath = await serialize(finalProject, finalOutputPath);
    logger.debug('Updated local project at ', fullFinalPath);

    logger.success('Updated project  at', config.endpoint);
  }
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
``;
