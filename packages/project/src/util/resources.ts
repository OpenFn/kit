import type l from '@openfn/lexicon';
import getCredentialName from './get-credential-name';
import slugify from './slugify';

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
