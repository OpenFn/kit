import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { Provisioner } from '@openfn/lexicon/lightning';

import type { Opts } from '../options';
import type { Logger } from '@openfn/logger';
import type Project from '@openfn/project';
import { CLIError } from '../errors';

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

export const serialize = async (
  project: Project,
  outputPath: string,
  formatOverride?: 'yaml' | 'json',
  dryRun = false
) => {
  const root = path.dirname(outputPath);
  await mkdir(root, { recursive: true });

  const format = formatOverride ?? project.config?.formats.project;
  const output = project?.serialize('project', { format });

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
