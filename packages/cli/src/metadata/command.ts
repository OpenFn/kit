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
      .option('adaptors', {
        // TODO I have to map this to adaptors to get it to map properly
        alias: ['a'],
        array: true,
        description:
          'A language adaptor to use for the job. Short-form names are allowed. Can include an explicit path to a local adaptor build.',
      })
      // TODO how can I make these more re-usable?
      // Maybea  big list of options in one file, and each command just imports the one it wants?
      .option('use-adaptors-monorepo', {
        alias: 'm',
        boolean: true,
        description:
          'Load adaptors from the monorepo. The OPENFN_ADAPTORS_REPO env var must be set to a valid path',
      })
      .example(
        'metadata -a salesforce -s tmp/state.json',
        'Generate salesforce metadata from config in state.json'
      ),
} as yargs.CommandModule<{}>;
