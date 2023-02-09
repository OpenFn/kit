import path from 'node:path';
import yargs from 'yargs';
import type { Opts } from './commands';
import expandAdaptors from './util/expand-adaptors';

export type CLIOption = {
  name: string;
  yargs: yargs.Options;
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
  },
  ensure: (opts) => {
    // Note that we always handle adaptors as an array for future proofing
    // But the CLI will only parse the first value
    // You can specify multiple adaptors with -a common -a http
    // (not that this is very useful at the moment)
    if (opts.adaptors) {
      if (!Array.isArray(opts.adaptors)) {
        opts.adaptors = [opts.adaptors];
      }
    } else {
      opts.adaptors = [];
    }
    opts.adaptors = expandAdaptors(opts.adaptors);

    // delete the aliases as they have not been massaged
    delete opts.adaptor;
    delete (opts as { a?: string[]}).a;
  },
};

export const autoinstall: CLIOption = {
  name: 'autoinstall',
  yargs: {
    alias: ['i'],
    boolean: true,
    description: 'Auto-install the language adaptor',
  },
  ensure: (opts) => {
    def(opts, 'autoinstall', false)
  },
};

export const compile: CLIOption = {
  name: 'no-compile',
  yargs: {
    boolean: true,
    description: 'Allow properties other than data to be returned in the output',
  },
  ensure: (opts) => {
    def(opts, 'compile', true)
  }
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

const getBaseDir = (opts: Opts) => {
  const basePath = opts.path ?? '.';
  if (basePath.endsWith('.js')) {
    return path.dirname(basePath);
  }
  return path.resolve(basePath);
  
}

export const jobPath: CLIOption = {
  name: 'job-path',
  yargs: {
    hidden: true,
  },
  ensure: (opts) => {
    const { path: basePath } = opts;
    if (basePath?.endsWith('.js')) {
      opts.jobPath = basePath;
    } else {
      const base = getBaseDir(opts);
      def(opts, 'jobPath', path.resolve(base, 'job.js'));
    }
  },
};

export const strictOutput: CLIOption = {
  name: 'no-strict-output',
  yargs: {
    boolean: true,
    description: 'Allow properties other than data to be returned in the output',
  },
  ensure: (opts) => {
    def(opts, 'strictOutput', true)
  }
};

export const skipAdaptorValidation: CLIOption = {
  name: 'skip-adaptor-validation',
  yargs: {
    boolean: true,
    description: 'Suppress warning message for jobs which don\'t use an adaptor',
  },
  ensure: (opts) => {
    def(opts, 'skipAdaptorValidation', false)
  }
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

export const timeout: CLIOption = {
  name: 'timeout',
  yargs: {
    alias: ['t'],
    number: true,
    description: 'Set the timeout duration (in milliseconds) [default: 5 minutes]',
  },
  ensure: (opts) => {
    def(opts, 'timeout', 5 * 60 * 1000)
  }
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