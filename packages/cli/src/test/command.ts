import yargs, { Arguments } from 'yargs';
import { Opts } from '../options';

export default {
  command: 'test',
  desc: 'Compiles and runs a test job, printing the result to stdout',
  handler: (argv: Arguments<Opts>) => {
    argv.command = 'test';
  },
  builder: (yargs: yargs.Argv) =>
    yargs
      .option('state-stdin', {
        alias: 'S',
        description: 'Read state from stdin (instead of a file)',
      })
      .example('test', 'run the test script')
      .example('test -S 42', 'run the test script with state 42'),
} as yargs.CommandModule<{}>;
