import { select } from '@inquirer/prompts';
import { Workspace, hasCheckoutMeta } from '@openfn/project';
import type Project from '@openfn/project';

import abort from '../util/abort';
import type { Logger } from '../util/logger';
import { writeCheckoutFile } from './util';

// Resolves to the chosen project, or null if the user skipped the question
type Prompt = (
  projects: Project[],
  defaultProject: Project
) => Promise<Project | null>;

type EnsureCheckoutOptions = {
  // Can we ask the user questions? Defaults to whether stdin is a terminal
  interactive?: boolean;
  prompt?: Prompt;
  // If false, carry on without a checkout when we can't ask the user, rather
  // than aborting (for commands that can work without one)
  required?: boolean;
};

const name = (project: Project) => project.alias ?? project.id;

// eg `staging (my-project | 1234-abcd)`. Either id may be missing
export const describeProject = (project: Project) => {
  const ids = [project.id, project.openfn?.uuid].filter(Boolean).join(' | ');
  return `${project.alias || '(no alias)'}${ids ? ` (${ids})` : ''}`;
};

const promptForProject: Prompt = (projects, defaultProject) =>
  select<Project | null>({
    message:
      'No checked out project found. Select the project which is currently tracked.',
    choices: [
      ...projects.map((project) => ({
        name: describeProject(project),
        value: project as Project | null,
        description: project.openfn?.endpoint,
      })),
      {
        name: 'Skip checkout',
        value: null,
        description: 'Continue without setting the checked out project',
      },
    ],
    default: defaultProject,
  });

// Guess which project is checked out: one with an alias matching the git
// branch (or main, if there's no branch), else just the first.
// Pass undefined, not null or false, if there is no branch
export const getDefaultProject = (projects: Project[], branch = 'main') =>
  projects.find((p) => p.alias === branch) ?? projects[0];

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
    required = true,
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

  if (projects.length > 1 && !interactive && !required) {
    logger.debug('No checked out project found: carrying on without one');
    return workspace;
  }

  let project: Project | null = null;
  if (projects.length === 1) {
    project = projects[0];
    logger.info(`No checked out project found: using ${name(project)}`);
  } else if (interactive) {
    logger.info(
      'Failed to find a checkout.yaml file, which describes which project is currently checked out. This usually happens when pulling a project from git.'
    );
    logger.info(
      "No problem - just pick which project is checked out. This won't affect your working tree, it'll just update local metadata and tell the CLI which remote project instance to track\n."
    );
    project = await prompt(
      projects,
      getDefaultProject(projects, workspace.branch || undefined)
    );
  } else {
    abort(logger, 'No checked out project found', {
      details: `This workspace tracks several projects (${projects
        .map(name)
        .join(', ')}) and it's not known which one is checked out`,
      fix: 'Run this command in an interactive terminal to choose one',
    });
  }

  if (!project) {
    logger.info('Skipped: no checked out project has been set');
    return workspace;
  }

  await writeCheckoutFile(workspace.root, project, workspace.branch);
  logger.success(`Set the checked out project to ${name(project)}`);

  return new Workspace(workspace.root, logger, true, {
    branch: workspace.branch,
  });
};
