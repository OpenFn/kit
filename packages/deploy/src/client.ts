import { DeployConfig, ProjectPayload } from './types';
import { DeployError } from './deployError';

const getLightningUrl = (config: DeployConfig, path: string = '') =>
  new URL(`/api/provision/${path}`, config.endpoint);

export async function getProject(
  config: DeployConfig,
  projectId: string
): Promise<{ data: ProjectPayload | null }> {
  const url = getLightningUrl(config, projectId);
  console.log(`Checking ${url} for existing project.`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
      },
    });

    // A 404 response means the project doesn't exist yet.
    if (response.status === 404) {
      console.log('No existing project found.');
      return { data: null };
    }

    if (!response.ok) {
      handle401(config, response);
      handle403(config, response);

      throw new Error(
        `Failed to fetch project ${projectId}: ${response.statusText}`
      );
    }

    console.log('Project found.');
    return response.json();
  } catch (error: any) {
    handleCommonErrors(config, error);

    throw error;
  }
}

export async function deployProject(
  config: DeployConfig,
  payload: any
): Promise<{ data: ProjectPayload }> {
  try {
    const url = getLightningUrl(config);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 422) {
        const body = await response.json();

        throw new DeployError(
          `Failed to deploy project ${payload.name}:\n${JSON.stringify(
            body,
            null,
            2
          )}`,
          'DEPLOY_ERROR'
        );
      }

      handle401(config, response);
      handle403(config, response);

      throw new DeployError(
        `Failed to deploy project ${payload.name}: ${response.statusText}`,
        'DEPLOY_ERROR'
      );
    }

    return response.json();
  } catch (error: any) {
    handleCommonErrors(config, error);

    throw error;
  }
}

function handle401(config: DeployConfig, response: Response) {
  if (response.status === 401) {
    throw new DeployError(
      `Failed to authorize request with endpoint ${config.endpoint}, got 401 Unauthorized.`,
      'DEPLOY_ERROR'
    );
  }
}

function handle403(config: DeployConfig, response: Response) {
  if (response.status === 403) {
    throw new DeployError(
      `Failed to authorize request with endpoint ${config.endpoint}, got 403 Forbidden.`,
      'DEPLOY_ERROR'
    );
  }
}

function handleCommonErrors(config: DeployConfig, error: any) {
  if (error.cause?.code === 'ECONNREFUSED') {
    throw new DeployError(
      `Failed to connect to endpoint ${config.endpoint}, got ECONNREFUSED.`,
      'DEPLOY_ERROR'
    );
  }
}
