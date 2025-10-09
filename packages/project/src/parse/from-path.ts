import { extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import fromAppState from './from-app-state';

type FromPathConfig = {};

// Load a project from a file path
// This ignores config files on disk
// Pass options explicitly
// Paths will be inferred from the source path
// TODO: should we try and find the nearest openfn.yaml file for config?
export default async (path: string, options: FromPathConfig) => {
  const ext = extname(path).toLowerCase();
  const source = await readFile(path, 'utf8');

  const config = {
    format: null,
  };
  if (ext === '.json') {
    config.format = 'json';
  } else if (ext.match(/(ya?ml)$/)) {
    config.format = 'yaml';
  } else {
    throw new Error(`Cannot load a project from a ${ext} file`);
  }

  // TODO: need to work out what kind of file this is
  // But right now it's easy - it must be a state v1

  return fromAppState(source, config);
};
