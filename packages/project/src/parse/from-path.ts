import * as l from '@openfn/lexicon';
import { readFile } from 'node:fs/promises';

import fromProject from './from-project';

export type FromPathConfig = l.WorkspaceConfig & {
  format: 'json' | 'yaml';
};

// Load a project from a file path.
// Pass config optionally
export default async (path: string, config: Partial<FromPathConfig> = {}) => {
  const source = await readFile(path, 'utf8');

  return fromProject(source, config);
};
