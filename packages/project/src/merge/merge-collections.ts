import { randomUUID } from 'node:crypto';
import { Provisioner } from '@openfn/lexicon/lightning';

/**
 * Diff a locally-edited list of collection names (from openfn.yaml, no ids)
 * against the collections that actually exist on the remote project (from a
 * fresh fetch, with real ids), matched by name.
 *
 * A local name with no match remotely is a new collection (gets a fresh
 * id). A remote collection with no matching local name is no longer wanted
 * and is flagged for deletion. Renaming is not supported: it's seen as a
 * delete of the old name plus a create of the new one.
 */
export function mergeCollections(
  source: string[] = [],
  target: Provisioner.Collection[] = []
): Provisioner.Collection[] {
  const targetByName = new Map(target.map((c) => [c.name, c]));
  const result: Provisioner.Collection[] = [];

  for (const name of source) {
    const existing = targetByName.get(name);
    if (existing) {
      result.push({ id: existing.id, name });
      targetByName.delete(name);
    } else {
      result.push({ id: randomUUID(), name });
    }
  }

  // anything left in targetByName was removed from the local list
  for (const remaining of Array.from(targetByName.values())) {
    result.push({ id: remaining.id, name: remaining.name, delete: true });
  }

  return result;
}
