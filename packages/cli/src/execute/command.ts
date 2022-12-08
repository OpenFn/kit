import yargs, { Arguments } from 'yargs';
import { Opts } from '../commands';

const executeCommand = {
  command: 'execute [path]',
  desc: `Run an openfn job. Get more help by running openfn <command> help`,
  aliases: ['$0'],
  handler: (argv: Arguments<Opts>) => {
    argv.command = 'execute';
  },
  builder: (yargs: yargs.Argv) => {
    return applyExecuteOptions(yargs)
      .option('immutable', {
        boolean: true,
        description: 'Treat state as immutable',
      })
      .option('adaptors-repo', {
        string: true,
        description:
          'Path to the adaptors monorepo. Adaptors will be loaded from here. You can also use env var OPENFN_ADAPTORS_REPO.',
      })
      .option('no-adaptors-repo', {
        boolean: true,
        description:
          'Set to disable using the adaptors repo through the env var',
      })
      .option('autoinstall', {
        alias: 'i',
        boolean: true,
        description: 'Auto-install the language adaptor',
      })
      .option('state-path', {
        alias: 's',
        description: 'Path to the state file',
      })
      .option('state-stdin', {
        alias: 'S',
        description: 'Read state from stdin (instead of a file)',
      })
      .option('no-compile', {
        boolean: true,
        description: 'Skip compilation',
      })
      .option('no-strict-output', {
        boolean: true,
        description:
          'Allow properties other than data to be returned in the output.',
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
      );
  },
} as yargs.CommandModule<Opts>;

export const applyExecuteOptions = (yargs: yargs.Argv) =>
  yargs
    .positional('path', {
      describe:
        'The path to load the job from (a .js file or a dir containing a job.js file)',
      demandOption: true,
    })
    .option('output-path', {
      alias: 'o',
      description: 'Path to the output file',
    })
    .option('output-stdout', {
      alias: 'O',
      boolean: true,
      description: 'Print output to stdout (instead of a file)',
    })
    .option('adaptors', {
      alias: ['a', 'adaptor'],
      description:
        'A language adaptor to use for the job. Short-form names are allowed. Can include an explicit path to a local adaptor build.',
      array: true,
    })
    .option('no-expand', {
      description: 'Don\t attempt to auto-expand adaptor shorthand names',
      boolean: true,
    });

export default executeCommand;
