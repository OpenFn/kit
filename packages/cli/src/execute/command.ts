import yargs from 'yargs';
import { build, ensure } from '../util/command-builders';
import * as o from '../options';

import type { Opts } from '../options';

export type ExecuteOptions = Required<
  Pick<
    Opts,
    | 'adaptors'
    | 'autoinstall'
    | 'baseDir'
    | 'cacheSteps'
    | 'command'
    | 'compile'
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
    | 'useAdaptorsMonorepo'
    | 'workflowPath'
    | 'globals'
  >
> &
  Pick<Opts, 'monorepoPath' | 'repoDir'>;

const options = [
  o.expandAdaptors, // order is important

  o.adaptors,
  o.autoinstall,
  o.cacheSteps,
  o.compile,
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
  o.useAdaptorsMonorepo,
];

const executeCommand: yargs.CommandModule<ExecuteOptions> = {
  command: 'execute <path> [workflow]',
  describe: `Run an openfn expression or workflow. Get more help by running openfn <command> help.
  \nExecute will run a expression/workflow at the path and write the output state to disk (to ./state.json unless otherwise specified)
  \nRemember to include the adaptor name with -a. Auto install adaptors with the -i flag.`,
  aliases: ['$0'],
  handler: ensure('execute', options),
  builder: (yargs) =>
    build(options, yargs)
      // TODO this is now path or workflow name
      .positional('path', {
        describe:
          'The path to load the job or workflow from (a .js or .json file or a dir containing a job.js file)',
        demandOption: true,
      })
      .example(
        'openfn foo/job.js',
        'Execute foo/job.js with no adaptor and write the final state to foo/job.json'
      )
      .example(
        'openfn workflow.json',
        'Execute the workflow contained in workflow.json'
      )
      .example(
        'openfn job.js -a common --log info',
        'Execute job.js with common adaptor and info-level logging'
      )
      .example(
        'openfn compile job.js -a http',
        'Compile the expression at job.js with the http adaptor and print the code to stdout'
      ),
};

export default executeCommand;
