import fs from 'node:fs';
import path from 'node:path';

import Project, { jsonToYaml } from '@openfn/project';
import type { Credential } from '@openfn/lexicon';

import { loadCredentialMap } from '../util/load-credential-map';
import type { Logger } from '../util/logger';

// Matches the `owner|name` format used for step.configuration references
// (see @openfn/project's util/get-credential-name)
const credentialKey = (c: Pick<Credential, 'name' | 'owner'>) =>
  `${c.owner}|${c.name}`;

// --- --credentials option parsing (project deploy) ---
//
// Supported forms:
//   prune                         only sync credentials referenced by workflows (default)
//   none                          sync no credentials
//   all                           sync every credential declared in the project, even if unreferenced
//   a,b,c=c:joe@openfn.org        sync only the named credentials, optionally
//                                  remapped to a new name:owner via "="

export type CredentialAlias = {
  name: string;
  owner?: string;
};

export type CredentialsMap = Record<string, CredentialAlias>;

export type CredentialsStrategy = 'none' | 'prune' | 'all' | CredentialsMap;

const KEYWORDS = ['none', 'prune', 'all'] as const;

export default function parseCredentialsOption(
  arg: unknown
): CredentialsStrategy {
  if (typeof arg !== 'string') {
    return arg as CredentialsStrategy;
  }

  const value = arg.trim();
  if ((KEYWORDS as readonly string[]).includes(value)) {
    return value as CredentialsStrategy;
  }

  const map: CredentialsMap = {};
  for (const rawEntry of value.split(',')) {
    const entry = rawEntry.trim();
    if (!entry) continue;

    const [key, aliasStr] = entry.split('=');
    const name = key.trim();

    if (aliasStr) {
      const [aliasName, aliasOwner] = aliasStr.split(':');
      map[name] = {
        name: aliasName.trim(),
        owner: aliasOwner?.trim(),
      };
    } else {
      map[name] = { name };
    }
  }
  return map;
}

// --- credential strategy visitors + traversal (project deploy) ---

// Visits a single credential. Return the credential (or a mapped copy of
// it) to keep it, or null to drop it.
export type CredentialVisitor = (credential: Credential) => Credential | null;

export const byNone: CredentialVisitor = () => null;

export const byAll: CredentialVisitor = (credential) => credential;

// Only keep credentials actually referenced by a step somewhere in the project
export const byPrune = (project: Project): CredentialVisitor => {
  const referenced = new Set(project.buildCredentialMap().map(credentialKey));
  return (credential) =>
    referenced.has(credentialKey(credential)) ? credential : null;
};

// Only keep credentials named in the map, optionally renamed/re-owned
export const byMap = (map: CredentialsMap): CredentialVisitor => {
  return (credential) => {
    const alias = map[credential.name];
    if (!alias) return null;
    return {
      ...credential,
      name: alias.name,
      owner: alias.owner ?? credential.owner,
    };
  };
};

export const getCredentialsVisitor = (
  project: Project,
  strategy: CredentialsStrategy
): CredentialVisitor => {
  if (strategy === 'none') return byNone;
  if (strategy === 'all') return byAll;
  if (strategy === 'prune') return byPrune(project);
  return byMap(strategy);
};

// Walks project.credentials through the visitor, then updates every
// workflow step's configuration reference to match: renamed credentials get
// their reference rewritten, dropped credentials have their reference removed.
export const remapCredentials = (
  project: Project,
  visit: CredentialVisitor
): Project => {
  const rekeyed = new Map<string, string | null>();
  const kept: Credential[] = [];

  for (const credential of project.credentials) {
    const oldKey = credentialKey(credential);
    const result = visit(credential);
    if (result) {
      kept.push(result);
      rekeyed.set(oldKey, credentialKey(result));
    } else {
      rekeyed.set(oldKey, null);
    }
  }

  for (const workflow of project.workflows) {
    for (const step of workflow.steps) {
      if (
        typeof step.configuration === 'string' &&
        rekeyed.has(step.configuration)
      ) {
        const newKey = rekeyed.get(step.configuration);
        if (newKey === null) {
          delete step.configuration;
        } else {
          step.configuration = newKey;
        }
      }
    }
  }

  project.credentials = kept;
  return project;
};

// --- credentials.yaml scaffolding (project pull / checkout) ---

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
