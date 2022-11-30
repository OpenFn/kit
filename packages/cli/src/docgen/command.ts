import yargs, { Arguments } from 'yargs';
import { Opts } from '../commands';

const docgenCommand = {
  command: 'docgen <specifier>',
  desc: 'Generate documentation into the repo. Specifier must include a version number.',
  handler: (argv: Arguments<Opts>) => {
    argv.command = 'docgen';
  },
  builder: (yargs: yargs.Argv) => {
    return yargs.example('docgen @openfn/language-common@1.7.5', '');
  },
} as yargs.CommandModule<Opts>;

export default docgenCommand;
