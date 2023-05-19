import { DeployOptions } from './types';

export async function getProject(config: DeployOptions, projectId: string) {
  const response = await fetch(`${config.endpoint}/projects/${projectId}`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: 'application/json',
    },
  });

  // A 404 response means the project doesn't exist yet.
  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch project ${projectId}: ${response.statusText}`
    );
  }

  return response.json();
}

export async function deployProject(config: DeployOptions, payload: any) {
  const response = await fetch(`${config.endpoint}/projects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to deploy project ${payload.name}: ${response.statusText}`
    );
  }

  return response.json();
}
