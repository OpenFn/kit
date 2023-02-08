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

export const statePath: CLIOption = {
  name: 'state-path',
  yargs: {
    alias: ['s'],
    description: 'Path to the state file',
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