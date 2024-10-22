import path from 'node:path';
import yargs from 'yargs';

import type { CommandList } from './commands';
import { DEFAULT_REPO_DIR } from './constants';
import {
  expandAdaptors as doExpandAdaptors,
  ensureLogOpts,
  LogLevel,
} from './util';

// Central type definition for the main options
// This represents the types coming out of yargs,
// after ensure() is called
export type Opts = {
  command?: CommandList;
  baseDir?: string;
  path?: string;

  adaptor?: boolean | string;
  adaptors?: string[];
  apolloUrl?: string;
  autoinstall?: boolean;
  cacheSteps?: boolean;
  compile?: boolean;
  configPath?: string;
  configType?: string;
  confirm?: boolean;
  describe?: string;
  end?: string; // workflow end node
  expandAdaptors?: boolean; // for unit tests really
  expressionPath?: string;
  force?: boolean;
  ignoreImports?: boolean | string[];
  immutable?: boolean;
  log?: Record<string, LogLevel>;
  logJson?: boolean;
  monorepoPath?: string;
  only?: string; // only run this workflow node
  operation?: string;
  outputPath?: string;
  outputStdout?: boolean;
  packages?: string[];
  planPath?: string;
  projectId?: string;
  projectPath?: string;
  repoDir?: string;
  sanitize: 'none' | 'remove' | 'summarize' | 'obfuscate';
  skipAdaptorValidation?: boolean;
  snapshots?: string[];
  specifier?: string; // docgen
  start?: string; // workflow start step
  statePath?: string;
  stateStdin?: string;
  timeout?: number; // ms
  useAdaptorsMonorepo?: boolean;

  // deprecated
  workflowPath?: string;
};

// Definition of what Yargs returns (before ensure is called)
export type UnparsedOpts = Opts & {
  ignoreImports?: boolean | string;
};

export type CLIOption = {
  name: string;
  // Allow this to take a function to lazy-evaluate env vars
  yargs: yargs.Options | (() => yargs.Options);
  ensure?: (opts: Partial<Opts>) => void;
};

const setDefaultValue = (
  opts: Partial<Opts>,
  key: keyof Opts,
  value: unknown
) => {
  const v = opts[key];
  if (isNaN(v as number) && !v) {
    // @ts-ignore
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

    // TODO this might be redundant now as load-plan should handle it
    // maybe commands other than execute need it
    if (opts.expandAdaptors) {
      opts.adaptors = doExpandAdaptors(opts.adaptors) as string[];
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
    description: 'Auto-install the language adaptor(s)',
    default: true,
  },
};

// how do I alias this to --staging, prod etc
export const apolloUrl: CLIOption = {
  name: 'apollo-url',
  yargs: {
    alias: ['url'],
    description: 'Auto-install the language adaptor(s)',
  },

  // map local, staging, prod to apollo-url
  ensure: (opts) => {
    let didLoadShortcut = false;
    ['local', 'staging', 'prod', 'production'].forEach((shortcut) => {
      if (shortcut in opts) {
        if (didLoadShortcut) {
          throw new Error(
            'Invalid apollo URL - please only enter one of local, staging or prod'
          );
        }

        opts.apolloUrl = shortcut;
        // @ts-ignore
        delete opts[shortcut];
        didLoadShortcut = true;
      }
    });
  },
};

export const cacheSteps: CLIOption = {
  name: 'cache-steps',
  yargs: {
    boolean: true,
    description:
      'Cache the output of steps to ./.cache/<workflow-name>/<step-name>.json',
  },
  ensure: (opts) => {
    if (
      process.env.OPENFN_ALWAYS_CACHE_STEPS &&
      !opts.hasOwnProperty('cacheSteps')
    ) {
      opts.cacheSteps = process.env.OPENFN_ALWAYS_CACHE_STEPS === 'true';
    }
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

export const confirm: CLIOption = {
  name: 'no-confirm',
  yargs: {
    boolean: true,
    description: "Skip confirmation prompts (e.g. 'Are you sure?')",
  },
  ensure: (opts) => {
    setDefaultValue(opts, 'confirm', true);
  },
};

export const configPath: CLIOption = {
  name: 'config',
  yargs: {
    alias: ['c', 'config-path'],
    description: 'The location of your config file',
    default: './.config.json',
  },
};

export const describe: CLIOption = {
  name: 'describe',
  yargs: {
    boolean: true,
    description: 'Downloads the project yaml from the specified instance',
  },
  ensure: (opts) => {
    setDefaultValue(opts, 'describe', true);
  },
};

export const expandAdaptors: CLIOption = {
  name: 'no-expand-adaptors',
  yargs: {
    boolean: true,
    description: "Don't try to auto-expand adaptor shorthand names",
  },
  ensure: (opts) => {
    setDefaultValue(opts, 'expandAdaptors', true);
  },
};

export const force: CLIOption = {
  name: 'force',
  yargs: {
    alias: ['f'],
    boolean: true,
    description: 'Force metadata to be regenerated',
    default: false,
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

export const ignoreImports: CLIOption = {
  name: 'ignore-imports',
  yargs: {
    description:
      "Don't auto-import references in compiled code. Can take a list of names to ignore.",
  },
  ensure: (opts) => {
    if (typeof opts.ignoreImports === 'string') {
      opts.ignoreImports = (opts.ignoreImports as string)
        .split(',')
        .map((s) => s.trim());
    }
  },
};

const getBaseDir = (opts: { path?: string }) => {
  const basePath = opts.path ?? '.';
  if (/\.(jso?n?)$/.test(basePath)) {
    return path.dirname(basePath);
  }
  return basePath;
};

export const projectId: CLIOption = {
  name: 'project-id',
  yargs: {
    hidden: true,
  },
  ensure: (opts) => {
    const projectId = opts.projectId;
    //check that this is a uuid
    return projectId;
  },
};

// Input path covers expressionPath and workflowPath
export const inputPath: CLIOption = {
  name: 'input-path',
  yargs: {
    hidden: true,
  },
  ensure: (opts) => {
    const { path: basePath } = opts;
    if (basePath?.endsWith('.json')) {
      opts.planPath = basePath;
    } else if (basePath?.endsWith('.js')) {
      opts.expressionPath = basePath;
    } else {
      const base = getBaseDir(opts);
      setDefaultValue(opts, 'expressionPath', path.join(base, 'job.js'));
    }
  },
};

export const log: CLIOption = {
  name: 'log',
  yargs: {
    alias: ['l'],
    description: 'Set the log level',
    string: true,
  },
  ensure: (opts: any) => {
    ensureLogOpts(opts);
  },
};

export const logJson: CLIOption = {
  name: 'log-json',
  yargs: {
    description: 'Output all logs as JSON objects',
    boolean: true,
  },
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
    // TODO these command specific rules don't sit well here
    if (/^(compile|apollo|configuration)$/.test(opts.command!)) {
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

export const projectPath: CLIOption = {
  name: 'project-path',
  yargs: {
    string: true,
    alias: ['p'],
    description: 'The location of your project.yaml file',
  },
};

export const repoDir: CLIOption = {
  name: 'repo-dir',
  yargs: () => ({
    description: 'Provide a path to the repo root dir',
    default: process.env.OPENFN_REPO_DIR || DEFAULT_REPO_DIR,
  }),
};

export const start: CLIOption = {
  name: 'start',
  yargs: {
    string: true,
    description: 'Specifiy the start step in a workflow',
  },
};

export const end: CLIOption = {
  name: 'end',
  yargs: {
    string: true,
    description: 'Specifiy the end step in a workflow',
  },
};

export const only: CLIOption = {
  name: 'only',
  yargs: {
    string: true,
    description: 'Specifiy to only run one step in a workflow',
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

export const snapshots: CLIOption = {
  name: 'snapshots',
  yargs: {
    description: 'List of snapshot ids to pull',
    array: true,
  },
};

export const statePath: CLIOption = {
  name: 'state-path',
  yargs: {
    alias: ['s'],
    description: 'Path to the state file',
  },
  ensure: (opts) => {
    // remove the alias
    delete (opts as { s?: string }).s;
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

export const sanitize: CLIOption = {
  name: 'sanitize',
  yargs: {
    string: true,
    alias: ['sanitise'],
    description:
      'Sanitize logging of objects and arrays: none (default), remove, summarize, obfuscate.',
    default: 'none',
  },
  ensure: (opts) => {
    if (
      !opts.sanitize ||
      opts.sanitize?.match(/^(none|summarize|remove|obfuscate)$/)
    ) {
      return;
    }
    const err = 'Unknown sanitize value provided: ' + opts.sanitize;
    console.error(err);
    throw new Error(err);
  },
};

export const configType: CLIOption = {
  name: 'configType',
  yargs: {
    alias: ['config-type'],
    description: 'Specify the schema to return - schema, sample, or both',
    default: 'both',
  },
  ensure: (opts) => {
    let didLoadShortcut = false;
    ['schema', 'sample', 'both'].forEach((shortcut) => {
      if (shortcut in opts) {
        if (didLoadShortcut) {
          throw new Error(
            'Invalid shortcut - please only enter one of sample, schema or both'
          );
        }

        opts.configType = shortcut;
        // @ts-ignore
        delete opts[shortcut];
        didLoadShortcut = true;
      }
    });
  },
};
