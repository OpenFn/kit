import { extname } from 'node:path';
import { readFile } from 'node:fs/promises';

import fromAppState from './from-app-state';
import { yamlToJson } from '../util/yaml';
import { WorkspaceConfig } from '../util/config';

export type FromPathConfig = {
  config: WorkspaceConfig;
};

// Load a project from a file path
// This ignores config files on disk
// Pass options explicitly
// Paths will be inferred from the source path
// TODO: should we try and find the nearest openfn.yaml file for config?
export default async (path: string, options: FromPathConfig = {}) => {
  const ext = extname(path).toLowerCase();
  const source = await readFile(path, 'utf8');

  const config = {
    format: null,
    config: options.config,
  };
  let state;
  if (ext === '.json') {
    config.format = 'json';
    state = JSON.parse(source);
  } else if (ext.match(/(ya?ml)$/)) {
    config.format = 'yaml';
    state = yamlToJson(source);
  } else {
    throw new Error(`Cannot load a project from a ${ext} file`);
  }

  return fromAppState(state, config);
};
