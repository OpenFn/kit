import type l from '@openfn/lexicon';
import getCredentialName from './get-credential-name';
import slugify from './slugify';
import { jsonToYaml, yamlToJson } from './yaml';
import type { Project } from '../Project';

// resources.yaml holds server-side resources, keyed by type (channels, ...)
export const RESOURCES_FILE = 'resources.yaml';

type ResourceChannels = Record<
  string,
  {
    name: string;
    destination_url: string;
    enabled: boolean;
    credential?: string;
  }
>;

// The id a channel is matched by on merge. Remote channels have no local key,
// so fall back to the name, slugified the same way as when it's written out
export const channelKey = (c: l.ChannelState) => c.key ?? slugify(c.name);

// Build the channels section of resources.yaml: keyed by an id slugified
// from the name, no uuids, credentials referenced by name
export const toResourceChannels = (
  channels: l.ChannelState[] = [],
  credentials: l.CredentialState[] = []
): ResourceChannels => {
  const result: ResourceChannels = {};
  for (const c of channels) {
    const cred = credentials.find(
      (cred) => cred.uuid === c.destination_credential_id
    );
    const credential = cred
      ? getCredentialName(cred)
      : c.destination_credential_id ?? undefined;

    // keep a local key if there is one, so renames survive a round trip
    const base = channelKey(c);
    let id = base;
    for (let i = 2; id in result; i++) {
      id = `${base}-${i}`;
    }
    result[id] = {
      name: c.name,
      destination_url: c.destination_url,
      enabled: c.enabled,
      ...(credential && { credential }),
    };
  }
  return result;
};

export const fromResourceChannels = (
  channels: ResourceChannels
): l.ChannelState[] =>
  Object.entries(channels).map(([id, c]) => {
    if (!c?.name) {
      throw new Error(`resources.yaml: channel "${id}" has no name`);
    }
    return {
      key: id,
      name: c.name,
      destination_url: c.destination_url,
      enabled: c.enabled ?? true,
      ...(c.credential && { destination_credential_id: c.credential }),
    };
  });

// Collections are keyed by name. The values are empty for now, but this
// leaves room for per-collection settings later (no uuids: those belong to
// the server)
type ResourceCollections = Record<string, Record<string, unknown>>;

export const toResourceCollections = (
  collections: l.CollectionState[] = []
): ResourceCollections =>
  collections.reduce((obj: ResourceCollections, c) => {
    obj[c.name] = {};
    return obj;
  }, {});

// Also accepts a plain list of names, which is how collections used to be
// written in openfn.yaml
export const fromResourceCollections = (
  collections: ResourceCollections | string[] | null | undefined
): l.CollectionState[] =>
  (Array.isArray(collections)
    ? collections
    : Object.keys(collections ?? {})
  ).map((name) => ({ name }));

// Build the contents of resources.yaml. Channels and collections are each only
// written if the project knows about them: a missing key means they are not
// managed locally
export const toResources = (project: Project) => {
  const resources: Record<string, unknown> = {};
  if (project.channels) {
    resources.channels = toResourceChannels(
      project.channels,
      project.credentials
    );
  }
  if (project.collections) {
    resources.collections = toResourceCollections(project.collections);
  }
  return Object.keys(resources).length ? jsonToYaml(resources) : undefined;
};

// Merge a project's collections into an existing resources.yaml, leaving
// everything else in the file (like channels) alone
export const updateResourceCollections = (
  project: Project,
  existing?: string
) => {
  if (!project.collections) {
    return existing;
  }
  const resources = (existing && yamlToJson(existing)) || {};
  resources.collections = toResourceCollections(project.collections);
  return jsonToYaml(resources);
};
