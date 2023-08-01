import yargs, { ArgumentsCamelCase } from 'yargs';
import { Opts } from '../options';

type DocGenOptions = Partial<Opts>; // TODO

// TODO make this work properly in the cli with new options
// ie it should take longs, you should be able to do docgen --help
// it should also use the repodir ensure stuff
const docgenCommand: yargs.CommandModule<Opts> = {
  command: 'docgen <specifier>',
  // Hide this command as it's not really for public usage
  describe: false, // 'Generate documentation into the repo. Specifier must include a version number.'
  handler: (argv: ArgumentsCamelCase<DocGenOptions>) => {
    argv.command = 'docgen';
  },
  builder: (yargs: yargs.Argv) =>
    yargs.example('docgen @openfn/language-common@1.7.5', ''),
};

export default docgenCommand;
