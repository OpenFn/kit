import yargs, { Arguments } from 'yargs';
import { Opts } from '../commands';

import * as o from '../options';


// build helper to chain options
const build = (opts) => (yargs) => opts.reduce(
  (_y, o) => yargs.option(o.name, o.yargs),
  yargs
);

// Mutate the incoming argv with defaults etc
const ensure = (command, opts) => (yargs) => {
  opts.command = command;
  opts.forEach(
    (opt) => {
      opt.ensure(yargs);
    },
  );
}

const options = [
  o.adaptors(),
  o.immutable()
]

const executeCommand = {
  command: 'execute [path]',
  desc: `Run an openfn job. Get more help by running openfn <command> help`,
  aliases: ['$0'],
  handler: ensure('execute', options), 
  builder: build(options)
    // return applyExecuteOptions(yargs)
      // .option('immutable', {
      //   boolean: true,
      //   description: 'Treat state as immutable',
      // })
      // .option('use-adaptors-monorepo', {
      //   alias: 'm',
      //   boolean: true,
      //   description:
      //     'Load adaptors from the monorepo. The OPENFN_ADAPTORS_REPO env var must be set to a valid path',
      // })
      // .option('autoinstall', {
      //   alias: 'i',
      //   boolean: true,
      //   description: 'Auto-install the language adaptor',
      // })
      // .option('state-path', {
      //   alias: 's',
      //   description: 'Path to the state file',
      // })
      // .option('state-stdin', {
      //   alias: 'S',
      //   description: 'Read state from stdin (instead of a file)',
      // })
      // .option('skip-adaptor-validation', {
      //   boolean: true,
      //   description: 'Skip adaptor validation warnings',

      // })
      // .option('timeout', {
      //   alias: '-t',
      //   description: 'Set the timeout duration in MS',
      // })
      // .option('no-compile', {
      //   boolean: true,
      //   description: 'Skip compilation',
      // })
      // .option('no-strict-output', {
      //   boolean: true,
      //   description:
      //     'Allow properties other than data to be returned in the output',
      // })
      // .example(
      //   'openfn foo/job.js',
      //   'Reads foo/job.js, looks for state and output in foo'
      // )
      // .example(
      //   'openfn job.js -a common',
      //   'Run job.js using @openfn/language-common'
      // )
      // .example(
      //   'openfn install -a common',
      //   'Install the latest version of language-common to the repo'
      // );
  // },
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
        'A language adaptor to use for the job. Short-form names are allowed. Can include an explicit path to a local adaptor build',
      array: true,
    })
    .option('no-expand', {
      description: 'Don\t attempt to auto-expand adaptor shorthand names',
      boolean: true,
    });

export default executeCommand;
