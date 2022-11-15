import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { repo as repoCommand, install as installCommand } from './repo/command';
import executeCommand from './execute/command';
import compileCommand from './compile/command';
import testCommand from './test/command';

export const cmd = yargs(hideBin(process.argv))
  .command(executeCommand as yargs.CommandModule<{}>)
  .command(compileCommand)
  .command(installCommand) // allow install to run from the top as well as repo
  .command(repoCommand)
  .command(testCommand)
  // Common options
  .option('log', {
    alias: ['l'],
    description: 'Set the default log level to none, default, info or debug',
    array: true,
  })
  .alias('v', 'version')
  .help();
