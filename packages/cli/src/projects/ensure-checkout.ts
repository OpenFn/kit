import { select } from '@inquirer/prompts';
import { Workspace, hasCheckoutMeta } from '@openfn/project';
import type Project from '@openfn/project';

import abort from '../util/abort';
import type { Logger } from '../util/logger';
import { writeCheckoutFile } from './util';

type Prompt = (
  projects: Project[],
  defaultProject: Project
) => Promise<Project>;

type EnsureCheckoutOptions = {
  // Can we ask the user questions? Defaults to whether stdin is a terminal
  interactive?: boolean;
  prompt?: Prompt;
};

const name = (project: Project) => project.alias ?? project.id;

const promptForProject: Prompt = (projects, defaultProject) =>
  select({
    message:
      'No checked out project found. Which project are the files in this workspace from?',
    choices: projects.map((project) => ({
      name: `${name(project)} (${project.id})`,
      value: project,
      description: project.openfn?.endpoint,
    })),
    default: defaultProject,
  });

// Guess which project is checked out: one with an alias matching the git
// branch, else the one called main, else just the first
export const getDefaultProject = (
  projects: Project[],
  branch?: string | false | null
) =>
  (branch ? projects.find((p) => p.alias === branch) : undefined) ??
  projects.find((p) => p.alias === 'main') ??
  projects[0];

/**
 * Make sure the workspace knows which project is checked out.
 *
 * If there's no checkout metadata (say, after a fresh git clone, since it's
 * not tracked in git), work out which project the files belong to and set
 * up the checkout file. The files themselves are not touched.
 *
 * Returns a workspace that reflects the checkout.
 */
export default async (
  workspace: Workspace,
  logger: Logger,
  {
    interactive = Boolean(process.stdin.isTTY),
    prompt = promptForProject,
  }: EnsureCheckoutOptions = {}
) => {
  if (!workspace.valid || hasCheckoutMeta(workspace.root, workspace.branch)) {
    return workspace;
  }

  const projects = workspace.list();
  if (!projects.length) {
    // Nothing to choose from: let the command report that in its own way
    return workspace;
  }

  let project: Project;
  if (projects.length === 1) {
    project = projects[0];
    logger.info(`No checked out project found: using ${name(project)}`);
  } else if (interactive) {
    project = await prompt(
      projects,
      getDefaultProject(projects, workspace.branch)
    );
  } else {
    abort(logger, 'No checked out project found', {
      details: `This workspace tracks several projects (${projects
        .map(name)
        .join(', ')}) and it's not known which one is checked out`,
      fix: 'Run this command in an interactive terminal to choose one',
    });
  }

  await writeCheckoutFile(workspace.root, project!, workspace.branch);
  logger.success(`Set the checked out project to ${name(project!)}`);

  return new Workspace(workspace.root, logger, true, {
    branch: workspace.branch,
  });
};
