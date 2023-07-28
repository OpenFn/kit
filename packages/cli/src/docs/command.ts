import yargs, { ArgumentsCamelCase } from 'yargs';
import { Opts } from '../options';

type DocsOptions = Partial<Opts>; // TODO

export default {
  command: 'docs <adaptor> [operation]',
  describe:
    'Print help for an adaptor function. You can use short-hand for adaptor names (ie, common instead of @openfn/language-common)',
  handler: (argv: ArgumentsCamelCase<DocsOptions>) => {
    argv.command = 'docs';
  },
  builder: (yargs: yargs.Argv) =>
    yargs.example('docs common fn', 'Print help for the common fn operation'),
} as yargs.CommandModule<DocsOptions>;
