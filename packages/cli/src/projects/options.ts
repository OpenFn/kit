import resolvePath from '../util/resolve-path';
import { Opts as BaseOpts, CLIOption } from '../options';
import getCLIOptionObject from '../util/get-cli-option-object';

export type Opts = BaseOpts & {
  alias?: string;
  env?: string;
  workspace?: string;
  removeUnmapped?: boolean | undefined;
  workflowMappings?: Record<string, string> | undefined;
  project?: string;
};

// project specific options
export const env: CLIOption = {
  name: 'env',
  yargs: {
    description: 'Environment name (eg staging, prod, branch)',
    hidden: true,
  },
};

export const alias: CLIOption = {
  name: 'alias',
  yargs: {
    alias: ['env'],
    description: 'Environment name (eg staging, prod, branch)',
  },
};

export const dryRun: CLIOption = {
  name: 'dryRun',
  yargs: {
    description:
      'Runs the command but does not commit any changes to disk or app',
  },
};

export const removeUnmapped: CLIOption = {
  name: 'remove-unmapped',
  yargs: {
    boolean: true,
    description:
      "Removes all workflows that didn't get mapped from the final project after merge",
  },
};

export const workflowMappings: CLIOption = {
  name: 'workflow-mappings',
  yargs: {
    type: 'string',
    coerce: getCLIOptionObject,
    description:
      'A manual object mapping of which workflows in source and target should be matched for a merge.',
  },
};

// We declare a new output path here, overriding the default cli one,
// because default rules are different
export const outputPath: CLIOption = {
  name: 'output-path',
  yargs: {
    alias: ['o', 'output'],
    type: 'string',
    description: 'Path to output the fetched project to',
  },
};

export const workspace: CLIOption = {
  name: 'workspace',
  yargs: {
    alias: ['w'],
    description: 'Path to the project workspace (ie, path to openfn.yaml)',
  },
  ensure: (opts: any) => {
    const ws = opts.workspace ?? process.env.OPENFN_WORKSPACE;
    if (!ws) {
      opts.workspace = process.cwd();
    } else {
      opts.workspace = resolvePath(ws);
    }
  },
};
