import yargs from 'yargs';
import Project, { versionsEqual, Workspace } from '@openfn/project';
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
  findLocallyChangedWorkflows,
  AuthOptions,
} from './util';
import { build, ensure } from '../util/command-builders';

import type { Provisioner } from '@openfn/lexicon/lightning';
import type { Logger } from '../util/logger';
import type { Opts } from '../options';

export const DEFAULT_ENDPOINT = 'https://app.openfn.org';

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
> & {
  project?: string; // this is a CLI positional arg, not an option
  workspace?: string;
  dryRun?: boolean;
  new?: boolean;
  name?: string;
  alias?: string;
};

const options = [
  // local options
  o2.env,
  o2.workspace,
  o2.dryRun,
  o2.new,
  o2.name,
  o2.alias,

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
  command: 'deploy [project]',
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
        'Deploy the checked-out project its connected remote instance'
      )
      .example(
        'deploy staging',
        'Deploy the checkout-out project to the remote project with alias "staging"'
      ),
  handler: ensure('project-deploy', options),
};

export const hasRemoteDiverged = (
  local: Project,
  remote: Project,
  workflows: string[] = []
): string[] | null => {
  let diverged: string[] | null = null;

  const refs = local.cli.forked_from ?? {};

  const filteredWorkflows = workflows.length
    ? local.workflows.filter((w) => workflows.includes(w.id))
    : local.workflows;

  // for each workflow, check that the local fetched_from is the head of the remote history
  for (const wf of filteredWorkflows) {
    if (wf.id in refs) {
      const forkedVersion = refs[wf.id];
      const remoteVersion = remote.getWorkflow(wf.id)?.history.at(-1);
      if (remoteVersion) {
        if (!versionsEqual(forkedVersion, remoteVersion!)) {
          diverged ??= [];
          diverged.push(wf.id);
        }
      }
    } else {
      // TODO what if there's no forked from for this workflow?
      // Do we assume divergence because we don't know? Do we warn?
    }
  }

  // TODO what if a workflow is removed locally?

  return diverged;
};

// This function is responsible for syncing changes in the user's local project
// with the remote app version
// It returns a merged state object
const syncProjects = async (
  options: DeployOptions,
  config: Required<AuthOptions>,
  ws: Workspace,
  localProject: Project,
  trackedProject: Project, // the project we want to update
  logger: Logger
): Promise<Project> => {
  // First step, fetch the latest version and write
  // this may throw!
  let remoteProject: Project;
  try {
    logger.info('Fetching remote target ', printProjectName(trackedProject));
    // TODO should we prefer endpoint over alias?
    // maybe if it's explicitly passed?
    const endpoint = trackedProject.openfn?.endpoint ?? config.endpoint;

    const { data } = await fetchProject(
      endpoint,
      config.apiKey,
      trackedProject.uuid!,
      logger
    );

    remoteProject = await Project.from('state', data!, {
      endpoint: endpoint,
    });

    logger.success('Downloaded latest version of project at ', endpoint);
  } catch (e) {
    console.log(e);
    throw e;
    // If fetch failed because of compatiblity with the local project, what do we do?
    // Well, actually I don't think I want this fetch to write to disk yet
    // So if force is passed, we merge and write it anyway
    // otherwise we throw because we've diverged
    // this will actually happen later
  }

  const locallyChangedWorkflows = await findLocallyChangedWorkflows(
    ws,
    localProject
  );

  // TODO: what if remote diff and the version checked disagree for some reason?
  const diffs = reportDiff(
    localProject,
    remoteProject,
    locallyChangedWorkflows,
    logger
  );
  if (!diffs.length) {
    logger.success('Nothing to deploy');
    process.exit(0);
  }

  // Ensure there's no divergence

  // Skip divergence testing if the remote has no history in its workflows
  // (this will only happen on older versions of lightning)
  // TODO now maybe skip if there's no forked_from
  const skipVersionTest =
    options.force ||
    remoteProject.workflows.find((wf) => wf.history.length === 0);

  if (skipVersionTest) {
    logger.warn(
      'Skipping compatibility check as no local version history detected'
    );
    logger.warn('Pushing these changes may overwrite changes made to the app');
  } else {
    const divergentWorkflows = hasRemoteDiverged(
      localProject,
      remoteProject!,
      locallyChangedWorkflows
    );
    if (divergentWorkflows) {
      logger.warn(
        `The following workflows have diverged: ${divergentWorkflows}`
      );
      if (!options.force) {
        logger.error(`Error: Projects have diverged!

  The remote project has been edited since the local project was branched. Changes may be lost.

  Pass --force to override this error and deploy anyway.`);
        process.exit(1);
      } else {
        logger.warn(
          'Remote project has diverged from local project! Pushing anyway as -f passed'
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
    // If pushing the same project, we use a replace strategy
    // Otherwise, use the sandbox strategy to preserve UUIDs
    mode: localProject.uuid === remoteProject.uuid ? 'replace' : 'sandbox',
    force: true,
    onlyUpdated: true,
  });

  return merged;
};

export async function handler(options: DeployOptions, logger: Logger) {
  logger.warn(
    'WARNING: the project deploy command is in BETA and may not be stable. Use cautiously on production projects.'
  );
  const config = loadAppAuthConfig(options, logger);

  // TODO this is the hard way to load the local alias
  // We need track alias in openfn.yaml to make this easier (and tracked in from fs)
  const ws = new Workspace(options.workspace || '.');

  const active = ws.getActiveProject();
  const alias = options.alias ?? active?.alias;

  const localProject = await Project.from('fs', {
    root: options.workspace || '.',
    alias,
    name: options.name,
  });

  // Track the remote we want to target
  // If the used passed a project alias, we need to use that
  // Otherwise just sync with the local project
  const tracker = ws.get(options.project ?? localProject.uuid!);

  if (!tracker) {
    // Is this really an error? Unlikely to happen I thuink
    console.log(
      `ERROR: Failed to find tracked remote project ${
        options.project ?? localProject.uuid!
      } locally`
    );
    console.log('To deploy a new project, add --new to the command');
    // TODO can we automate the fetch bit?
    // If it's a UUID it should be ok?
    console.log(
      'You may need to fetch the project before you can safely deploy'
    );

    throw new Error('Failed to find remote project locally');
  }

  let endpoint: string = tracker.openfn?.endpoint ?? '';

  if (options.new) {
    endpoint =
      config.endpoint ?? localProject.openfn?.endpoint ?? DEFAULT_ENDPOINT;

    // reset all metadata
    localProject.openfn = {
      endpoint: config.endpoint,
    };
  }
  // generate a credential map
  localProject.credentials = localProject.buildCredentialMap();

  logger.success(
    `Loaded checked-out project ${printProjectName(localProject)}`
  );

  const merged: Project = options.new
    ? localProject
    : await syncProjects(options, config, ws, localProject, tracker, logger);

  const state = merged.serialize('state', {
    format: 'json',
  }) as Provisioner.Project_v1;

  // TODO only do this if asked
  // or maybe write it to output with -o?
  // maybe we can write state.app, state.local and state.result
  // this is heavy debug stuff
  logger.debug('Provisioner state ready to upload:');
  logger.debug(JSON.stringify(state, null, 2));
  logger.debug();

  // TODO: I want to report diff HERE, after the merged state and stuff has been built

  if (options.dryRun) {
    logger.always('dryRun option set: skipping upload step');
  } else {
    // sync summary
    // :+1: the remove project has not changed since last sync / the remote project has changed since last sync, and your changes may overwrite these
    // The following workflows will be updated

    if (options.confirm) {
      if (!(await logger.confirm(`Ready to deploy changes to ${endpoint}?`))) {
        logger.always('Cancelled deployment');
        return false;
      }
    }

    logger.info('Sending project to app...');

    /*const { data: result } =*/ await deployProject(
      endpoint,
      config.apiKey,
      state,
      logger
    );

    // TMP because of a provisioner bug, fetch the project back down
    // rather than just using the returned value
    // (the history will be incorrect)
    // https://github.com/OpenFn/lightning/issues/4455
    const { data: result } = await fetchProject(
      endpoint,
      config.apiKey,
      state.id
    );

    const finalProject = await Project.from(
      'state',
      result as any,
      {
        endpoint: endpoint,
        alias,
      },
      merged.config
    );

    updateForkedFrom(finalProject);
    const configData = finalProject.generateConfig();
    await writeFile(
      path.resolve(options.workspace!, configData.path),
      configData.content
    );

    const finalOutputPath = getSerializePath(localProject, options.workspace!);
    const fullFinalPath = await serialize(finalProject, finalOutputPath);
    logger.debug('Updated local project at ', fullFinalPath);

    logger.success('Updated project  at', endpoint);
  }
}

export const reportDiff = (
  local: Project,
  remote: Project,
  locallyChangedWorkflows: string[],
  logger: Logger
) => {
  const diffs = remote.diff(local, locallyChangedWorkflows);
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
