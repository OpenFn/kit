import type l from '@openfn/lexicon';
import getCredentialName from './get-credential-name';

// resources.yaml holds server-side resources, keyed by type (channels, ...)
export const RESOURCES_FILE = 'resources.yaml';

type ResourceChannels = Record<
  string,
  { destination_url: string; enabled: boolean; credential?: string }
>;

// Build the channels section of resources.yaml: keyed by name, no ids,
// credentials referenced by name
export const toResourceChannels = (
  channels: l.ChannelState[] = [],
  credentials: l.CredentialState[] = []
): ResourceChannels =>
  Object.fromEntries(
    channels.map((c) => {
      const cred = credentials.find(
        (cred) => cred.uuid === c.destination_credential_id
      );
      const credential = cred
        ? getCredentialName(cred)
        : c.destination_credential_id ?? undefined;
      return [
        c.name,
        {
          destination_url: c.destination_url,
          enabled: c.enabled,
          ...(credential && { credential }),
        },
      ];
    })
  );

export const fromResourceChannels = (
  channels: ResourceChannels
): l.ChannelState[] =>
  Object.entries(channels).map(([name, c]) => ({
    name,
    destination_url: c.destination_url,
    enabled: c.enabled ?? true,
    ...(c.credential && { destination_credential_id: c.credential }),
  }));
