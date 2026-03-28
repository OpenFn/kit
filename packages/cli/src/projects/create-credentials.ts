import fs from 'node:fs';
import path from 'node:path';

import type Project from '@openfn/project';
import { jsonToYaml, yamlToJson } from '@openfn/project';

import { CREDENTIALS_KEY } from '../execute/apply-credential-map';
import type { Logger } from '../util/logger';

export function collectCredentialReferences(project: Project): string[] {
  const ids = new Set<string>();
  for (const wf of project.workflows) {
    for (const step of wf.steps) {
      const job = step as {
        configuration?: string | Record<string, unknown> | null;
      };
      const { configuration } = job;
      // picking credential
      if (typeof configuration === 'string' && configuration.trim()) {
        if (!configuration.endsWith('.json')) {
          ids.add(configuration);
        }
      } else if (
        // picking from an obj
        configuration &&
        typeof configuration === 'object' &&
        !Array.isArray(configuration) &&
        typeof configuration[CREDENTIALS_KEY] === 'string' &&
        (configuration[CREDENTIALS_KEY] as string).trim()
      ) {
        ids.add(configuration[CREDENTIALS_KEY] as string);
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
  if (typeof credentialsPath !== 'string' || !credentialsPath.trim()) return;

  const ids = collectCredentialReferences(project);
  if (!ids.length) return;

  const absolutePath = path.resolve(workspacePath, credentialsPath);
  let existing: Record<string, unknown> = {};

  if (fs.existsSync(absolutePath)) {
    const raw = fs.readFileSync(absolutePath, 'utf8');
    if (raw.trim()) {
      try {
        if (credentialsPath.endsWith('.json')) {
          const parsed = JSON.parse(raw) as unknown;
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            throw new Error('credential file contains invalid JSON');

          existing = parsed as Record<string, unknown>;
        } else {
          const parsed = yamlToJson(raw) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            existing = parsed as Record<string, unknown>;
          } else if (parsed != null) {
            throw new Error('credential file contains invalid YAML');
          }
        }
      } catch (e: any) {
        throw new Error(
          `Failed to parse credential at ${credentialsPath}: ${e?.message ?? e}`
        );
      }
    }
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
