import pkg from '../../package.json' assert { type: 'json' };
import { Context } from '../api/execute';

export type Versions = {
  node: string;
  worker: string;
  engine: string;

  [adaptor: string]: string;
};

export const calculateVersions = async (
  context: Context
): Promise<Versions> => {
  return {
    node: process.version,
    worker: pkg.version,
    engine: context.engine.version || 'unknown',

    // ... adaptors: read from the autoinstall paths
    // But wait, this is deep in the engine too
    // Well OK, should then the ENGINE calculate versions?

    // Ok, so we can't really report these easily, but they are
    // implied by the engine version!
    // compiler: tricky, this is embedded deep in the engine
    // runtime: also tricky as it's ebedded in the engine
  };
};

export const calculateVersionString = (versions: Versions) => {};
