import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { repo as repoCommand, install as installCommand } from './repo/command';
import executeCommand from './execute/command';
import compileCommand from './compile/command';
import testCommand from './test/command';
import docgenCommand from './docgen/command';
import docsCommand from './docs/command';
import { Opts } from './commands';

export const cmd = yargs(hideBin(process.argv))
  .command(executeCommand)
  .command(compileCommand)
  .command(installCommand) // allow install to run from the top as well as repo
  .command(repoCommand)
  .command(testCommand)
  .command(docsCommand)
  .command(docgenCommand)
  // Common options
  .option('log', {
    alias: ['l'],
    description: 'Set the default log level to none, default, info or debug',
    array: true,
  })
  .example('openfn execute help', 'Show documentation for the execute command')
  .example(
    'openfn docs @openfn/language-common each',
    'Get more help on the common.each command'
  )
  .alias('v', 'version')
  .help() as yargs.Argv<Opts>;
