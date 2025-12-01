import { Provisioner } from '@openfn/lexicon/lightning';
import type { Opts } from '../options';
import type { Logger } from '@openfn/logger';

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

export const getLightningUrl = (
  config: AuthOptions,
  path: string = '',
  snapshots?: string[]
) => {
  const params = new URLSearchParams();
  snapshots?.forEach((snapshot) => params.append('snapshots[]', snapshot));
  return new URL(
    `/api/provision/${path}?${params.toString()}`,
    config.endpoint
  );
};

export async function getProject(
  logger: Logger,
  config: AuthOptions,
  projectId: string,
  snapshots?: string[]
): Promise<{ data: Provisioner.Project | null }> {
  const url = getLightningUrl(config, projectId, snapshots);
  logger.info(`Checking ${url} for existing project`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
      },
    });

    // A 404 response means the project doesn't exist yet
    if (response.status === 404) {
      logger.info('No project found');
      return { data: null };
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new DeployError(
          `Failed to authorize request with endpoint ${config.endpoint}, got ${response.status} ${response.statusText}`
        );
      }

      throw new Error(
        `Failed to fetch project ${projectId}: ${response.statusText}`
      );
    }

    logger.info('Project found');
    return response.json();
  } catch (error: any) {
    handleCommonErrors(config, error);

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
