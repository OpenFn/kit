import type Project from '@openfn/project';
import type { Credential } from '@openfn/lexicon';

import type { CredentialsMap, CredentialsStrategy } from './parse-credentials-option';

// Matches the `owner|name` format used for step.configuration references
// (see @openfn/project's util/get-credential-name)
const credentialKey = (c: Pick<Credential, 'name' | 'owner'>) =>
  `${c.owner}|${c.name}`;

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
