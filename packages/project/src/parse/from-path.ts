import * as l from '@openfn/lexicon';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import fromProject from './from-project';

export type FromPathConfig = l.WorkspaceConfig & {
  format: 'json' | 'yaml';
  alias?: string;
};

// Extract alias from filename in format: alias@domain.yaml or alias.yaml
// If format is alias@domain.ext, returns the alias part
// Otherwise returns the filename without extension
export const extractAliasFromFilename = (filename: string): string => {
  const basename = path.basename(filename, path.extname(filename));

  // Check for alias@domain format
  const atIndex = basename.indexOf('@');
  if (atIndex > 0) {
    return basename.substring(0, atIndex);
  }

  // Otherwise return the basename as-is
  return basename;
};

// Load a project from a file path.
// Pass config optionally
export default async (
  filePath: string,
  config: Partial<FromPathConfig> = {}
) => {
  const source = await readFile(filePath, 'utf8');

  const alias = config.alias ?? extractAliasFromFilename(filePath);

  return fromProject(source, { ...config, alias });
};
