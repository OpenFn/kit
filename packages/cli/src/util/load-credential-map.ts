import fs from 'node:fs';
import { yamlToJson } from '@openfn/project';

export function loadCredentialMap(filePath: string): Record<string, unknown> {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return {};

  if (filePath.endsWith('.json')) {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('credential file contains invalid JSON');
    }
    return parsed as Record<string, unknown>;
  } else {
    const parsed = yamlToJson(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    } else if (parsed != null) {
      throw new Error('credential file contains invalid YAML');
    }
    return {};
  }
}
