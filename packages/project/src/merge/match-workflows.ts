import Workflow from '../Workflow';

/**
 * Pair up the workflows of a source project with those of a target
 *
 * A source workflow is matched to a target workflow by, in order:
 * 1. uuid
 * 2. id
 * 3. name (only if it's unique among the workflows still unmatched on both sides)
 *
 * Matches are one-to-one. A match where the ids differ is a rename.
 *
 * Returns a map of source workflow id -> target workflow id.
 * Unmatched workflows do not appear in it.
 */
export default function matchWorkflows(
  source: Workflow[],
  target: Workflow[]
): Record<string, string> {
  const matches: Record<string, string> = {};
  const claimed = new Set<string>(); // target ids

  const unmatched = () => source.filter((s) => !(s.id in matches));
  const available = () => target.filter((t) => !claimed.has(t.id));
  const claim = (s: Workflow, t: Workflow) => {
    matches[s.id] = t.id;
    claimed.add(t.id);
  };

  for (const s of unmatched()) {
    const uuid = s.openfn?.uuid;
    if (uuid) {
      const t = available().find((t) => t.openfn?.uuid === uuid);
      if (t) {
        claim(s, t);
      }
    }
  }

  for (const s of unmatched()) {
    const t = available().find((t) => t.id === s.id);
    if (t) {
      claim(s, t);
    }
  }

  for (const s of unmatched()) {
    if (s.name) {
      const sources = unmatched().filter((x) => x.name === s.name);
      const targets = available().filter((t) => t.name === s.name);
      if (sources.length === 1 && targets.length === 1) {
        claim(s, targets[0]);
      }
    }
  }

  return matches;
}
