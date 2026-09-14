// Parses the --credentials option for `project deploy`.
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
