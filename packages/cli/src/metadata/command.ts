import yargs, { Arguments } from 'yargs';
import { Opts } from '../commands';

export default {
  command: 'metadata',
  desc: 'Generate metadata for an adaptor config',
  handler: (argv: Arguments<Opts>) => {
    argv.command = 'metadata';
  },
  builder: (yargs: yargs.Argv) =>
    yargs
      .option('state-path', {
        alias: 's',
        description: 'Path to the state file',
      })
      .option('state-stdin', {
        alias: 'S',
        description: 'Read state from stdin (instead of a file)',
      })
      .option('adaptor', {
        alias: ['a'],
        description:
          'A language adaptor to use for the job. Short-form names are allowed. Can include an explicit path to a local adaptor build.',
      })
      .example(
        'metadata -a salesforce -s tmp/state.json',
        'Generate salesforce metadata from config in state.json'
      ),
} as yargs.CommandModule<{}>;
