import ensureJson from './ensure-json';

// Detect whether a project spec is v1 (Lightning app state) or v2 (local project state)
// Accepts YAML/JSON strings or a pre-parsed object
export default function detectVersion(projectSpec: string | object): number {
  const json = ensureJson<any>(projectSpec);
  if (json.schema_version) {
    return parseInt(json.schema_version, 10);
  }
  if (json.cli?.version === 2 || json.version) {
    return 2;
  }
  return 1;
}
