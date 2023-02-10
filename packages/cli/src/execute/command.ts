import yargs, { Arguments } from 'yargs';
import { Opts } from '../commands';

import * as o from '../options';
import type { CLIOption } from '../options';

// build helper to chain options
const build = (opts: CLIOption[], yargs: yargs.Argv) => opts.reduce(
  (_y, o) => yargs.option(o.name, o.yargs),
  yargs
);

// Mutate the incoming argv with defaults etc
const ensure = (command, opts) => (yargs) => {
  yargs.command = command;
  opts.forEach(
    (opt) => {
      opt.ensure(yargs);
    },
  );
}

// override yargs properties for a command
// (a better pattern than the functions)
const override = (command, yargs) => {
  return ({
    ...commmand,
    yargs: {
      ...command.yargs || {},
      ...yargs
    }
  })
} 

const options = [
  o.adaptors,
  o.autoinstall,
  o.compile,
  o.expandAdaptors,
  o.immutable,
  o.jobPath,
  o.outputPath,
  o.outputStdout,
  o.skipAdaptorValidation,
  o.statePath,
  o.stateStdin,
  o.strictOutput,
  o.timeout,
  o.useAdaptorsMonorepo,
]

// TODO what's a nice way to pull out just the opts we need?
type ExecuteOptions = Opts;

const executeCommand = {
  command: 'execute [path]',
  desc: `Run an openfn job. Get more help by running openfn <command> help`,
  aliases: ['$0'],
  handler: ensure('execute', options), 
  builder: (yargs) => build(options, yargs)
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
    )
} as yargs.CommandModule<ExecuteOptions>;

export default executeCommand;
