import yargs, { Arguments } from 'yargs';
import { Opts } from '../commands';

const executeCommand = {
  command: 'execute [path]',
  desc: 'Run an openfn job',
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
};

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
      description: 'Print output to stdout (intead of a file)',
    })
    .option('adaptors', {
      alias: ['a', 'adaptor'],
      description:
        'A language adaptor to use for the job. Short-form names are allowed. Can include an explicit path to a local adaptor build.',
      array: true,
    });

export default executeCommand;
