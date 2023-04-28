import yargs from 'yargs';
import { Opts } from '../options';
import { build, ensure } from '../util/command-builders';
import * as o from '../options';

export type ExecuteOptions = Required<
  Pick<
    Opts,
    | 'adaptors'
    | 'autoinstall'
    | 'command'
    | 'compile'
    | 'expandAdaptors'
    | 'immutable'
    | 'ignoreImports'
    | 'jobPath'
    | 'log'
    | 'logJson'
    | 'outputPath'
    | 'outputStdout'
    | 'path'
    | 'repoDir'
    | 'skipAdaptorValidation'
    | 'start'
    | 'statePath'
    | 'stateStdin'
    | 'strict'
    | 'timeout'
    | 'useAdaptorsMonorepo'
    | 'workflowPath'
    | 'workflow'
  >
> &
  Pick<Opts, 'monorepoPath' | 'repoDir'>;

const options = [
  o.expandAdaptors, // order is important

  o.adaptors,
  o.autoinstall,
  o.compile,
  o.immutable,
  o.ignoreImports,
  o.inputPath,
  o.logJson,
  o.outputPath,
  o.outputStdout,
  o.repoDir,
  o.skipAdaptorValidation,
  o.start,
  o.statePath,
  o.stateStdin,
  o.strict, // order important
  o.strictOutput,
  o.timeout,
  o.useAdaptorsMonorepo,
];

const executeCommand = {
  command: 'execute [path]',
  desc: `Run an openfn job or workflow. Get more help by running openfn <command> help.
  \nExecute will run a job/workflow at the path and write the output state to disk (to ./state.json unless otherwise specified)
  \nBy default only state.data will be returned fron a job. Include --no-strict to write the entire state object.
  \nRemember to include the adaptor name with -a. Auto install adaptors with the -i flag.`,
  aliases: ['$0'],
  handler: ensure('execute', options),
  builder: (yargs) =>
    build(options, yargs)
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
        'openfn workflow.json -ia common',
        'Execute workflow.json using @openfn/language-commom (with autoinstall enabled)'
      )
      .example(
        'openfn job.js -a common --log info',
        'Execute job.js with common adaptor and info-level logging'
      )
      .example(
        'openfn compile job.js -a http',
        'Compile job.js with the http adaptor and print the code to stdout'
      ),
} as yargs.CommandModule<ExecuteOptions>;

export default executeCommand;
