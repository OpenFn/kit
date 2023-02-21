import path from 'node:path';
import yargs from 'yargs';
import type { Opts } from './commands';
import doExpandAdaptors from './util/expand-adaptors';
import { DEFAULT_REPO_DIR } from './util/ensure-opts';

export type CLIOption = {
  name: string;
  yargs: yargs.Options;
  ensure: (opts: Opts) => void;
};

// little util to default a value
// TODO why not use yargs.default?
const def = (opts, key, value) => {
  const v = opts[key];
  if (isNaN(v) && !v) {
    opts[key] = value;
  }
};

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
    opts.adaptors = doExpandAdaptors(opts.adaptors);

    // delete the aliases as they have not been massaged
    delete opts.adaptor;
    delete (opts as { a?: string[] }).a;
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
    def(opts, 'autoinstall', false);
  },
};

export const compile: CLIOption = {
  name: 'no-compile',
  yargs: {
    boolean: true,
    description: 'Disable compilation of the incoming source',
  },
  ensure: (opts) => {
    def(opts, 'compile', true);
  },
};

export const expandAdaptors: CLIOption = {
  name: 'no-expand-adaptors',
  yargs: {
    boolean: true,
    description: 'Don\t attempt to auto-expand adaptor shorthand names',
  },
  ensure: (opts) => {
    def(opts, 'expandAdaptors', true);
  },
};

export const immutable: CLIOption = {
  name: 'immutable',
  yargs: {
    description: 'Enforce immutabilty on state object',
    boolean: true,
  },
  ensure: (opts) => {
    def(opts, 'immutable', false);
  },
};

const getBaseDir = (opts: Opts) => {
  const basePath = opts.path ?? '.';
  if (basePath.endsWith('.js')) {
    return path.dirname(basePath);
  }
  return path.resolve(basePath);
};

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

// TODO this needs unit testing
export const logJson: CLIOption = {
  name: 'log-json',
  yargs: {
    description: 'Output all logs as JSON objects',
    boolean: true,
  },
  ensure: () => {},
};

export const outputStdout: CLIOption = {
  name: 'output-stdout',
  yargs: {
    alias: 'O',
    boolean: true,
    description: 'Print output to stdout (instead of a file)',
  },
  ensure: (opts) => {
    def(opts, 'outputStdout', false);
  },
};

export const outputPath: CLIOption = {
  name: 'output-path',
  yargs: {
    alias: 'o',
    description: 'Path to the output file',
  },
  ensure: (opts) => {
    if (opts.command == 'compile') {
      if (opts.outputPath) {
        // If a path is set, remove the stdout flag
        delete opts.outputStdout;
      }
    } else {
      if (opts.outputStdout) {
        delete opts.outputPath;
      } else {
        const base = getBaseDir(opts);
        def(opts, 'outputPath', path.resolve(base, 'output.json'));
      }
    }
    // remove the alias
    delete (opts as { o?: string }).o;
  },
};

export const repoDir: CLIOption = {
  name: 'repo-dir',
  yargs: {
    description: 'Provide a path to the repo root dir',
    default: process.env.OPENFN_REPO_DIR || DEFAULT_REPO_DIR,
  },
  ensure: () => {},
};

export const strictOutput: CLIOption = {
  name: 'no-strict-output',
  yargs: {
    boolean: true,
    description:
      'Allow properties other than data to be returned in the output',
  },
  ensure: (opts) => {
    def(opts, 'strictOutput', true);
  },
};

export const skipAdaptorValidation: CLIOption = {
  name: 'skip-adaptor-validation',
  yargs: {
    boolean: true,
    description: "Suppress warning message for jobs which don't use an adaptor",
  },
  ensure: (opts) => {
    def(opts, 'skipAdaptorValidation', false);
  },
};

export const statePath: CLIOption = {
  name: 'state-path',
  yargs: {
    alias: ['s'],
    description: 'Path to the state file',
  },
  ensure: () => {},
};

// TODO no unit tests yet
// This is just a no-op, so what's the point in creating a near-empty test file?
export const stateStdin: CLIOption = {
  name: 'state-stdin',
  yargs: {
    alias: ['S'],
    description: 'Read state from stdin (instead of a file)',
  },
  ensure: () => {},
};

export const timeout: CLIOption = {
  name: 'timeout',
  yargs: {
    alias: ['t'],
    number: true,
    description: 'Set the timeout duration (in milliseconds)',
    default: '5 minutes',
  },
  ensure: (opts) => {
    def(opts, 'timeout', 5 * 60 * 1000);
  },
};

export const useAdaptorsMonorepo: CLIOption = {
  name: 'use-adaptors-monorepo',
  yargs: {
    alias: ['m'],
    boolean: true,
    description:
      'Load adaptors from the monorepo. The OPENFN_ADAPTORS_REPO env var must be set to a valid path',
  },
  ensure: (opts) => {
    if (opts.useAdaptorsMonorepo) {
      opts.monorepoPath = process.env.OPENFN_ADAPTORS_REPO || 'ERR';
    }
  },
};
