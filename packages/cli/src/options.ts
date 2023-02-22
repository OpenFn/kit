import path from 'node:path';
import yargs from 'yargs';
import doExpandAdaptors from './util/expand-adaptors';
import { DEFAULT_REPO_DIR } from './util/ensure-opts';
import type { CommandList } from './commands';

// Central type definition for the main options
// This is in flux as options are being refactoreds
export type Opts = {
  command?: CommandList;
  baseDir?: string;
  path?: string;

  adaptor?: boolean | string;
  adaptors?: string[];
  autoinstall?: boolean;
  compile?: boolean;
  expandAdaptors?: boolean; // for unit tests really
  force?: boolean;
  immutable?: boolean;
  jobPath?: string;
  log?: string[];
  logJson?: boolean;
  monorepoPath?: string;
  operation?: string;
  outputPath?: string;
  outputStdout?: boolean;
  packages?: string[];
  repoDir?: string;
  skipAdaptorValidation?: boolean;
  specifier?: string; // docgen
  statePath?: string;
  stateStdin?: string;
  strictOutput?: boolean; // defaults to true
  timeout?: number; // ms
  useAdaptorsMonorepo?: string | boolean;
};

export type CLIOption = {
  name: string;
  yargs: yargs.Options;
  ensure?: (opts: Opts) => void;
};

const setDefaultValue = (opts: Opts, key: keyof Opts, value: any) => {
  const v: any = opts[key];
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
    if (opts.expandAdaptors) {
      opts.adaptors = doExpandAdaptors(opts.adaptors);
    }

    // delete the aliases as they have not been expanded
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
    default: false,
  },
};

export const compile: CLIOption = {
  name: 'no-compile',
  yargs: {
    boolean: true,
    description: 'Disable compilation of the incoming source',
  },
  ensure: (opts) => {
    setDefaultValue(opts, 'compile', true);
  },
};

export const expandAdaptors: CLIOption = {
  name: 'no-expand-adaptors',
  yargs: {
    boolean: true,
    description: 'Don\t attempt to auto-expand adaptor shorthand names',
  },
  ensure: (opts) => {
    setDefaultValue(opts, 'expandAdaptors', true);
  },
};

export const immutable: CLIOption = {
  name: 'immutable',
  yargs: {
    description: 'Enforce immutabilty on state object',
    boolean: true,
    default: false,
  },
};

const getBaseDir = (opts: Opts) => {
  const basePath = opts.path ?? '.';
  if (basePath.endsWith('.js')) {
    return path.dirname(basePath);
  }
  return basePath;
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
      setDefaultValue(opts, 'jobPath', path.join(base, 'job.js'));
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
    setDefaultValue(opts, 'outputStdout', false);
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
        setDefaultValue(opts, 'outputPath', path.join(base, 'output.json'));
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
};

export const strictOutput: CLIOption = {
  name: 'no-strict-output',
  yargs: {
    boolean: true,
    description:
      'Allow properties other than data to be returned in the output',
  },
  ensure: (opts) => {
    setDefaultValue(opts, 'strictOutput', true);
  },
};

export const skipAdaptorValidation: CLIOption = {
  name: 'skip-adaptor-validation',
  yargs: {
    boolean: true,
    description: "Suppress warning message for jobs which don't use an adaptor",
    default: false,
  },
};

export const statePath: CLIOption = {
  name: 'state-path',
  yargs: {
    alias: ['s'],
    description: 'Path to the state file',
  },
};

export const stateStdin: CLIOption = {
  name: 'state-stdin',
  yargs: {
    alias: ['S'],
    description: 'Read state from stdin (instead of a file)',
  },
};

export const timeout: CLIOption = {
  name: 'timeout',
  yargs: {
    alias: ['t'],
    number: true,
    description: 'Set the timeout duration (ms). Defaults to 5 minutes.',
    default: 5 * 60 * 1000,
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
