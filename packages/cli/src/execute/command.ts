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
    | 'jobPath'
    | 'log'
    | 'logJson'
    | 'outputPath'
    | 'outputStdout'
    | 'path'
    | 'repoDir'
    | 'skipAdaptorValidation'
    | 'statePath'
    | 'stateStdin'
    | 'strictOutput'
    | 'timeout'
    | 'useAdaptorsMonorepo'
  >
> &
  Pick<Opts, 'monorepoPath' | 'repoDir'>;

const options = [
  o.expandAdaptors, // order is important

  o.adaptors,
  o.autoinstall,
  o.compile,
  o.immutable,
  o.jobPath,
  o.logJson,
  o.outputPath,
  o.outputStdout,
  o.repoDir,
  o.skipAdaptorValidation,
  o.statePath,
  o.stateStdin,
  o.strictOutput,
  o.timeout,
  o.useAdaptorsMonorepo,
];

const executeCommand = {
  command: 'execute [path]',
  desc: `Run an openfn job. Get more help by running openfn <command> help`,
  aliases: ['$0'],
  handler: ensure('execute', options),
  builder: (yargs) =>
    build(options, yargs)
      .positional('path', {
        describe:
          'The path to load the job from (a .js file or a dir containing a job.js file)',
        demandOption: true,
      })
      .example(
        'openfn foo/job.js',
        'Reads foo/job.js, looks for state and output in foo'
      )
      .example(
        'openfn job.js -a common',
        'Run job.js using @openfn/language-common'
      )
      .example(
        'openfn install -a common',
        'Install the latest version of language-common to the repo'
      ),
} as yargs.CommandModule<ExecuteOptions>;

export default executeCommand;
