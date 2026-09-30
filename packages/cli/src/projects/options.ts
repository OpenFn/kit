import { execSync } from 'node:child_process';
import resolvePath from '../util/resolve-path';
import { Opts as BaseOpts, CLIOption } from '../options';
import getCLIOptionObject from '../util/get-cli-option-object';
import parseCredentialsOption from './credentials-helpers';

export type {
  CredentialsStrategy,
  CredentialsMap,
  CredentialAlias,
} from './credentials-helpers';

export type Opts = BaseOpts & {
  alias?: string;
  env?: string;
  workspace?: string;
  removeUnmapped?: boolean | undefined;
  workflowMappings?: Record<string, string> | undefined;
  workflow?: string[];
  project?: string;
  format?: 'yaml' | 'json' | 'state';
  clean?: boolean;
  createCredentials?: boolean;
  branch?: string | false;
  track?: boolean;
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

export const clean: CLIOption = {
  name: 'clean',
  yargs: {
    description: 'Clean the working dir before checking out the new project',
    default: false,
    boolean: true,
  },
};

export const track: CLIOption = {
  name: 'track',
  yargs: {
    boolean: true,
    description:
      'When on a git branch, make this branch track the checked out project (by default, checking out a different project only expands its files)',
  },
};

export const creds: CLIOption = {
  name: 'create-credentials',
  yargs: {
    boolean: true,
    default: true,
    description:
      'Create a credentials.yaml file and intialize with empty values',
  },
};

export const credentials: CLIOption = {
  name: 'credentials',
  yargs: {
    alias: ['creds', 'cred', 'c'],
    type: 'string',
    default: 'prune',
    coerce: parseCredentialsOption,
    description:
      'Credential sync strategy: "prune" (used creds only), "none", "all", a comma-separated list or map (my-cred=you@openfn.org|your-cred), or a path to a credentials.yaml file.',
  },
};

export const dryRun: CLIOption = {
  name: 'dryRun',
  yargs: {
    description:
      'Runs the command but does not commit any changes to disk or app',
  },
};

export const format: CLIOption = {
  name: 'format',
  yargs: {
    hidden: true,
    description:
      'The format to save the project as - state, yaml or json. Use this to download raw state files.',
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

export const workflow: CLIOption = {
  name: 'workflow',
  yargs: {
    alias: ['w'],
    array: true,
    description:
      'Restrict merge/deploy to the given workflow ids. Pass multiple times to include multiple workflows. Listed workflows are force-included from the source and will overwrite the target/remote even if unchanged locally. Mutually exclusive with --workflow-mappings.',
  },
  ensure: (opts: any) => {
    if (opts.workflow?.length) {
      opts.workflow = Array.from(new Set(opts.workflow));
    }
    delete opts.w;
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

// Returns the current git branch, or false if not on a branch
// (not a git repo, git not installed, detached HEAD)
const detectBranch = (cwd: string) => {
  try {
    const branch = execSync('git symbolic-ref --short -q HEAD', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return branch || false;
  } catch (e) {
    return false;
  }
};

// Must come after the workspace option so that the workspace path is resolved
export const branch: CLIOption = {
  name: 'branch',
  yargs: {
    description:
      'The git branch to track the checked out project against. Detected automatically if not set. Pass --no-branch to ignore git.',
  },
  ensure: (opts: any) => {
    let value = opts.branch ?? process.env.OPENFN_BRANCH;
    if (typeof value === 'string' && /^(false|null)?$/.test(value)) {
      value = false;
    }
    if (value === undefined || value === true) {
      const cwd = opts.workspace ?? process.env.OPENFN_WORKSPACE ?? '.';
      value = detectBranch(resolvePath(cwd));
    }
    opts.branch = value === false ? false : String(value);
  },
};

const newProject: CLIOption = {
  name: 'new',
  yargs: {
    description: 'Create a new project when deploying',
    default: false,
    boolean: true,
  },
};

export const name: CLIOption = {
  name: 'name',
  yargs: {
    type: 'string',
    description: 'When deploying a new project, set the name',
  },
};

export const jsonDiff: CLIOption = {
  name: 'json-diff',
  yargs: {
    alias: ['diff-json'],
    boolean: true,
    description:
      'Show a full JSON diff of the project state instead of the default rich text summary',
  },
};

export { newProject as new };
