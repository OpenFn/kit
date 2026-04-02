import fs from 'node:fs';
import path from 'node:path';

import type Project from '@openfn/project';
import { jsonToYaml } from '@openfn/project';

import { loadCredentialMap } from '../util/load-credential-map';
import type { Logger } from '../util/logger';

export function findCredentialIds(project: Project): string[] {
  const ids = new Set<string>();
  for (const wf of project.workflows) {
    for (const step of wf.steps) {
      const job = step as { configuration?: string | null };
      const { configuration } = job;
      if (
        typeof configuration === 'string' &&
        configuration &&
        !configuration.endsWith('.json')
      ) {
        ids.add(configuration);
      }
    }
  }
  return Array.from(ids);
}

export function createProjectCredentials(
  workspacePath: string,
  project: Project,
  logger?: Logger
): void {
  const credentialsPath = project.config.credentials;
  if (typeof credentialsPath !== 'string') return;

  const ids = findCredentialIds(project);
  if (!ids.length) return;

  const absolutePath = path.resolve(workspacePath, credentialsPath);
  let existing: Record<string, unknown> = {};

  try {
    existing = loadCredentialMap(absolutePath);
  } catch (e: any) {
    // project doesn't have credential
  }

  const new_creds = ids.filter((id) => !(id in existing)).sort();
  if (!new_creds.length) return;

  const merged: Record<string, unknown> = { ...existing };
  for (const id of new_creds) {
    merged[id] = {};
  }

  const content = credentialsPath.endsWith('.json')
    ? `${JSON.stringify(merged, null, 2)}`
    : jsonToYaml(merged);

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');
  logger?.debug(`Added ${new_creds.length} credentials to ${credentialsPath}`);
}
