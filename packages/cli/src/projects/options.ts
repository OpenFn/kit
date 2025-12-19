import { CLIOption } from '../options';
import getCLIOptionObject from '../util/get-cli-option-object';

export type Opts = {
  env?: string;
  workspace?: string;
  removeUnmapped?: boolean | undefined;
  workflowMappings?: Record<string, string> | undefined;
};

// project specific options
export const env: CLIOption = {
  name: 'env',
  yargs: {
    description: '[beta only] Environment name (eg staging, prod, branch)',
    hidden: true,
  },
};

export const alias: CLIOption = {
  name: 'alias',
  yargs: {
    description: '[beta only] Environment name (eg staging, prod, branch)',
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

export const workspace: CLIOption = {
  name: 'workspace',
  yargs: {
    alias: ['w'],
    description: 'Path to the project workspace (ie, path to openfn.yaml)',
  },
  ensure: (opts) => {
    const ws = opts.workspace ?? process.env.OPENFN_WORKSPACE;
    if (!ws) {
      opts.workspace = process.cwd();
    } else {
      opts.workspace = nodePath.resolve(ws);
    }
  },
};
