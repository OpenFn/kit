import yargs, { Arguments } from 'yargs';
import { hideBin } from 'yargs/helpers';

// TODO typings are pretty rough, just trying to get something running again
type Argv = Record<string, string>;

const installCommand = {
  command: 'install [packages...]',
  desc: 'install one or more packages to the runtime repo',
  handler: (argv: Argv) => {
    argv.command = 'install';
  },
  builder: (yargs: yargs.Argv) => {
    return yargs
      .option('adaptor', {
        alias: ['a'],
        description: 'Indicate that the packages are langauge adaptors',
        boolean: true,
      })
      .example(
        'install axios',
        "Install the axios npm package to the CLI's repo"
      )
      .example(
        'install -a http',
        "Install the http language adaptor to the CLI's repo"
      );
  },
};

const testCommand = {
  command: 'test',
  desc: 'Compiles and runs a test job, printing the result to stdout',
  handler: (argv: Argv) => {
    argv.command = 'test';
  },
};

const compileCommand = {
  command: 'compile [path]',
  desc: 'compile a openfn job and print or save the resulting js',
  handler: (argv: Argv) => {
    argv.command = 'compile';
  },
  builder: (yargs: yargs.Argv) => {
    return applyCommonOptions(yargs)
      .example(
        'compile foo/job.js -O',
        'Compiles foo/job.js and prints the result to stdout'
      )
      .example(
        'compile foo/job.js -o foo/job-compiled.js',
        'Compiles foo/job.js and saves the result to foo/job-compiled.js'
      );
  },
};

const executeCommand = {
  command: 'execute [path]',
  desc: 'Run an openfn job',
  aliases: ['$0'],
  handler: (argv: Argv) => {
    argv.command = 'execute';
  },
  builder: (yargs: yargs.Argv) => {
    return applyCommonOptions(yargs)
      .option('immutable', {
        boolean: true,
        description: 'Treat state as immutable',
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
        'openfn path/to/dir',
        'Looks for job.js, state.json in path/to/dir'
      )
      .example(
        'openfn foo/job.js',
        'Reads foo/job.js, looks for state and output in foo'
      )
      .example(
        'openfn job.js -adaptor @openfn/language-common',
        'Run job.js with automatic imports from the commmon language adaptor'
      )
      .example(
        'openfn job.js -adaptor @openfn/language-common=repo/openfn/language-common',
        'Run job.js with a local implementation of the common language adaptor'
      );
  },
};

const applyCommonOptions = (yargs: yargs.Argv) =>
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
      description: 'Pass one or more adaptors in the form name=path/to/adaptor',
      array: true,
    });

export const cmd = yargs(hideBin(process.argv))
  .command(executeCommand as yargs.CommandModule<{}>)
  .command(compileCommand as yargs.CommandModule<{}>)
  .command(installCommand as yargs.CommandModule<{}>)
  .command(testCommand as yargs.CommandModule<{}>)
  .option('log', {
    alias: ['l'],
    description: 'Set the default log level to none, trace, info or default',
    array: true,
  })
  .alias('v', 'version')
  .help();
