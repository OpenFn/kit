import yargs from 'yargs';
import { build, ensure, override } from '../util/command-builders';
import * as o from '../options';
import * as po from '../projects/options';

import type { Opts } from '../options';

export type ExecuteOptions = { workspace?: string } & Required<
  Pick<
    Opts,
    | 'apiKey'
    | 'adaptors'
    | 'autoinstall'
    | 'baseDir'
    | 'cacheSteps'
    | 'command'
    | 'compile'
    | 'credentials'
    | 'collectionsEndpoint'
    | 'collectionsVersion'
    | 'expandAdaptors'
    | 'end'
    | 'immutable'
    | 'ignoreImports'
    | 'expressionPath'
    | 'log'
    | 'logJson'
    | 'outputPath'
    | 'outputStdout'
    | 'only'
    | 'path'
    | 'repoDir'
    | 'skipAdaptorValidation'
    | 'start'
    | 'statePath'
    | 'stateStdin'
    | 'sanitize'
    | 'timeout'
    | 'trace'
    | 'useAdaptorsMonorepo'
    | 'workflowPath'
    | 'workflowName'
    | 'globals'
  >
> &
  Pick<Opts, 'monorepoPath' | 'repoDir'>;

const options = [
  o.expandAdaptors, // order is important

  o.adaptors,
  override(o.apiKey, {
    description: 'API token for collections',
    alias: ['collections-api-key', 'collections-token', 'pat'],
  }),
  o.autoinstall,
  o.cacheSteps,
  o.compile,
  o.credentials,
  o.collectionsEndpoint,
  o.collectionsVersion,
  o.end,
  o.ignoreImports,
  o.immutable,
  o.inputPath,
  o.log,
  o.logJson,
  o.only,
  o.outputPath,
  o.outputStdout,
  o.repoDir,
  o.sanitize,
  o.skipAdaptorValidation,
  o.start,
  o.statePath,
  o.stateStdin,
  o.timeout,
  o.trace,
  o.useAdaptorsMonorepo,

  po.workspace,
];

const executeCommand: yargs.CommandModule<ExecuteOptions> = {
  command: 'execute <path> [workflow]',
  describe: `Run an openfn expression or workflow. Get more help by running openfn <command> help.
  \nExecute will run a expression/workflow at the path and write the output state to disk (to ./state.json unless otherwise specified)`,
  aliases: ['$0'],
  handler: ensure('execute', options),
  builder: (yargs) =>
    build(options, yargs)
      // TODO this is now path or workflow name
      .positional('path', {
        describe: 'The path or name of the workflow or expression to run',
        demandOption: true,
      })
      .example(
        'openfn my-workflow',
        'Execute a workflow called my-workflow. Requires an openfn.yaml file (created by openfn project pull)'
      )
      .example(
        'openfn foo/job.js',
        'Execute foo/job.js (with no adaptor) and write the final state to foo/job.json'
      )
      .example(
        'openfn workflow.json',
        'Execute the workflow contained in workflow.json'
      )
      .example(
        'openfn job.js -a common --log info',
        'Execute job.js with common adaptor (which will be automatically installed) and info-level logging'
      )
      .example(
        'openfn job.js -ma common',
        'Execute job.js with the build of the common adaptor found in your adaptors monorepo'
      ),
};

export default executeCommand;
