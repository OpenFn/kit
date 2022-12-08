import yargs, { Arguments } from 'yargs';
import { Opts } from '../commands';

export default {
  command: 'docs [adaptor] [operation]',
  desc: 'Print help for an adaptor function. You can use short-hand for adaptor names (ie, common instead of @openfn/language-common)',
  handler: (argv: Arguments<Opts>) => {
    argv.command = 'docs';
  },
  builder: (yargs: yargs.Argv) =>
    yargs.example('docs common fn', 'Print help for the common fn operation'),
} as unknown as yargs.CommandModule<Opts>;
