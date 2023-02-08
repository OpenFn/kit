import path from 'node:path';
import yargs from 'yargs';
import type { Opts } from './commands';
import expandAdaptors from './util/expand-adaptors';

type CLIOption = {
  name: string;
  yargs?: yargs.Options;
  ensure: (opts: Opts) => void;
}

// little util to default a value
const def = (opts, key, value) => {
  const v = opts[key];
  if (isNaN(v) && !v) {
    opts[key] = value;
  }
}

export const adaptors: CLIOption = {
  name: 'adaptors',
  yargs: {
    alias: ['a', 'adaptor'],
    description:
      'A language adaptor to use for the job. Short-form names are allowed. Can include an explicit path to a local adaptor build',
    array: true
  },
  ensure: (opts) => {
    // TODO what if an alias was passed?
    if (opts.adaptors) {
      if (!Array.isArray(opts.adaptors)) {
        opts.adaptors = [opts.adaptors];
      }
    } else {
      opts.adaptors = [];
    }
    opts.adaptors = expandAdaptors(opts.adaptors);
  },
};

export const autoinstall: CLIOption = {
  name: 'autoinstall',
  yargs: {
    alias: ['a'],
    boolean: true,
    description: 'Auto-install the language adaptor',
  },
  ensure: (opts) => {
    def(opts, 'autoinstall', false)
  },
};

export const immutable: CLIOption = {
  name: 'immutable',
  yargs: {
    description: 'Enforce immutabilty on state object',
    boolean: true,
  },
  ensure: (opts) => {
    def(opts, 'immutable', false)
  },
};

export const basePath: CLIOption = {
  name: 'basePath',
  yargs: {
    hidden: true,
  },
  ensure: (opts) => {
    const basePath = opts.path ?? '.';
    if (basePath.endsWith('.js')) {
      opts.baseDir = path.dirname(basePath);
    } else {
      opts.baseDir = basePath;
    }
  },
};

// don't really like this
// it's hard to unit test because it has this secret dependency on basePath
// Then again, working out job and output paths is specific to certain commands only
export const jobPath: CLIOption = {
  name: 'jobPath',
  yargs: {
    hidden: true,
  },
  ensure: (opts) => {
    def(opts, 'jobPath', `${opts.baseDir}/job.js`);
  },
};

export const statePath: CLIOption = {
  name: 'state-path',
  yargs: {
    alias: ['s'],
    description: 'Path to the state file',
  },
  ensure: () => {}
};

// TODO no unit tests yet
// This is just a no-op, so what's the point in creating a near-empty test file?
export const stateStdin: CLIOption = {
  name: 'state-stdin',
  yargs: {
    alias: ['S'],
    description: 'Read state from stdin (instead of a file)',
  },
  ensure: () => {}
};

export const useAdaptorsMonorepo: CLIOption = {
  name: 'use-adaptors-monorepo',
  yargs: {
    alias: ['m'],
    boolean: true,
    description: 'Load adaptors from the monorepo. The OPENFN_ADAPTORS_REPO env var must be set to a valid path',
  },
  ensure: (opts) => {
    if (opts.useAdaptorsMonorepo) {
      opts.monorepoPath = process.env.OPENFN_ADAPTORS_REPO || 'ERR';
    }
  },
};