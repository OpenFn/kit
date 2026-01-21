import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { Provisioner } from '@openfn/lexicon/lightning';

import type { Opts } from '../options';
import type { Logger } from '@openfn/logger';
import type Project from '@openfn/project';
import { CLIError } from '../errors';
import resolvePath from '../util/resolve-path';
import { rimraf } from 'rimraf';

type AuthOptions = Pick<Opts, 'apiKey' | 'endpoint'>;

export const loadAppAuthConfig = (
  options: AuthOptions,
  logger: Logger
): Required<AuthOptions> => {
  const { OPENFN_API_KEY, OPENFN_ENDPOINT } = process.env;

  const config: AuthOptions = {
    apiKey: options.apiKey,
    endpoint: options.endpoint,
  };

  if (!options.apiKey && OPENFN_API_KEY) {
    logger.info('Using OPENFN_API_KEY environment variable');
    config.apiKey = OPENFN_API_KEY;
  }

  if (!options.endpoint && OPENFN_ENDPOINT) {
    logger.info('Using OPENFN_ENDPOINT environment variable');
    config.endpoint = OPENFN_ENDPOINT;
  }

  // TODO probably need to throw

  return config as Required<AuthOptions>;
};

const ensureExt = (filePath: string, ext: string) => {
  if (!filePath.endsWith(ext)) {
    return `${filePath}.${ext}`;
  }
  return filePath;
};

export const getSerializePath = (
  project?: Project,
  workspacePath?: string,
  outputPath?: string
) => {
  const outputRoot = resolvePath(outputPath || workspacePath || '.');
  const projectsDir = project?.config.dirs.projects ?? '.projects';
  return outputPath ?? `${outputRoot}/${projectsDir}/${project?.qname}`;
};

export const serialize = async (
  project: Project,
  outputPath: string,
  formatOverride?: 'yaml' | 'json' | 'state',
  dryRun = false
) => {
  const root = path.dirname(outputPath);
  await mkdir(root, { recursive: true });

  const format = formatOverride ?? project.config?.formats.project;

  const output =
    format === 'state'
      ? project?.serialize('state', { format: 'json' })
      : project?.serialize('project', { format });

  const maybeWriteFile = (filePath: string, output: string) => {
    if (!dryRun) {
      return writeFile(filePath, output);
    }
  };

  let finalPath;
  if (format === 'yaml') {
    finalPath = ensureExt(outputPath, 'yaml');
    await maybeWriteFile(finalPath, output as string);
  } else {
    finalPath = ensureExt(outputPath, 'json');
    await maybeWriteFile(finalPath, JSON.stringify(output, null, 2));
  }

  return finalPath;
};

export const getLightningUrl = (
  endpoint: string,
  path: string = '',
  snapshots?: string[]
) => {
  const params = new URLSearchParams();
  snapshots?.forEach((snapshot) => params.append('snapshots[]', snapshot));
  return new URL(`/api/provision/${path}?${params.toString()}`, endpoint);
};

// TODO move to client.ts
export async function fetchProject(
  endpoint: string,
  apiKey: string,
  projectId: string,
  logger?: Logger,
  snapshots?: string[]
): Promise<{ data: Provisioner.Project | null }> {
  const url = getLightningUrl(endpoint, projectId, snapshots);
  logger?.info(`Checking ${url} for existing project`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new CLIError(
          `Failed to authorize request with endpoint ${endpoint}, got ${response.status} ${response.statusText}`
        );
      }
      if (response.status === 404) {
        throw new CLIError(`Project not found: ${projectId}`);
      }

      throw new CLIError(
        `Failed to fetch project ${projectId}: ${response.statusText}`
      );
    }
    logger?.info(`Project retrieved from ${endpoint}`);
    return response.json();
  } catch (error: any) {
    handleCommonErrors({ endpoint, apiKey }, error);

    throw error;
  }
}

export async function deployProject(
  endpoint: string,
  apiKey: string,
  state: Provisioner.Project_v1,
  logger?: Logger
): Promise<{ data: Provisioner.Project_v1 }> {
  try {
    const url = getLightningUrl(endpoint);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(state),
    });

    if (!response.ok) {
      const body = await response.json();

      logger?.error('Failed to deploy project:');
      logger?.error(JSON.stringify(body, null, 2));
      throw new CLIError(
        `Failed to deploy project ${state.name}: ${response.status}`
      );
    }

    return await response.json();
  } catch (error: any) {
    handleCommonErrors({ endpoint, apiKey }, error);

    throw error;
  }
}

function handleCommonErrors(config: AuthOptions, error: any) {
  if (error.cause?.code === 'ECONNREFUSED') {
    throw new DeployError(
      `Failed to connect to endpoint ${config.endpoint}, got ECONNREFUSED.`
    );
  }
}

class DeployError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function tidyWorkflowDir(
  currentProject: Project | undefined,
  incomingProject: Project | undefined,
  dryRun = false
) {
  if (!currentProject || !incomingProject) {
    return [];
  }

  const currentFiles = currentProject.serialize('fs');
  const newFiles = incomingProject.serialize('fs');

  const toRemove: string[] = [];
  // any files not in the new list should be removed
  for (const path in currentFiles) {
    if (!newFiles[path]) {
      toRemove.push(path);
    }
  }

  if (!dryRun) {
    await rimraf(toRemove);
  }

  // Return and sort for testing
  return toRemove.sort();
}
