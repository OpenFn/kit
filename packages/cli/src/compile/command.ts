import yargs, { Arguments } from 'yargs';
import { Opts } from '../commands';
import { applyExecuteOptions } from '../execute/command';

const compileCommand = {
  command: 'compile [path]',
  desc: 'compile a openfn job and print or save the resulting js',
  handler: (argv: Arguments<Opts>) => {
    argv.command = 'compile';
  },
  builder: (yargs: yargs.Argv) => {
    return applyExecuteOptions(yargs)
      .example(
        'compile foo/job.js -O',
        'Compiles foo/job.js and prints the result to stdout'
      )
      .example(
        'compile foo/job.js -o foo/job-compiled.js',
        'Compiles foo/job.js and saves the result to foo/job-compiled.js'
      );
  },
} as yargs.CommandModule<{}>;

export default compileCommand;
