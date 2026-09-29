import type l from '@openfn/lexicon';
import getCredentialName from './get-credential-name';

export const CHANNELS_FILE = 'channels.yaml';

type ChannelsFile = Record<
  string,
  { destination_url: string; enabled: boolean; credential?: string }
>;

// Build the user-facing channels.yaml content: keyed by name, no ids,
// credentials referenced by name
export const toChannelsFile = (
  channels: l.ChannelState[] = [],
  credentials: l.CredentialState[] = []
): ChannelsFile =>
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

export const fromChannelsFile = (file: ChannelsFile | null): l.ChannelState[] =>
  Object.entries(file ?? {}).map(([name, c]) => ({
    name,
    destination_url: c.destination_url,
    enabled: c.enabled ?? true,
    ...(c.credential && { destination_credential_id: c.credential }),
  }));
