import yargs, { Arguments } from 'yargs';
import { Opts } from '../commands';
import { applyExecuteOptions } from '../execute/command';

const docgenCommand = {
  command: 'docgen [specifier]',
  desc: 'Generate documentation to the repo. Specifier can take a version number, or else the latest will be used.',
  handler: (argv: Arguments<Opts>) => {
    argv.command = 'docgen';
  },
  builder: (yargs: yargs.Argv) => {
    return applyExecuteOptions(yargs).example(
      'docgen @openfn/language-common@1.7.5',
      'Generates docs for a specific version of language-common'
    );
  },
} as yargs.CommandModule<Opts>;

export default docgenCommand;
