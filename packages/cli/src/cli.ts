import yargs, { Arguments } from 'yargs';
import { hideBin } from 'yargs/helpers';

import compileCommand from './compile/command';
import deployCommand from './deploy/command';
import docgenCommand from './docgen/command';
import docsCommand from './docs/command';
import executeCommand from './execute/command';
import metadataCommand from './metadata/command';
import pullCommand from './pull/command';
import { Opts } from './options';
import { install as installCommand, repo as repoCommand } from './repo/command';
import testCommand from './test/command';

const y = yargs(hideBin(process.argv));

export const cmd = y
  .command(executeCommand as any)
  .command(compileCommand as any)
  .command(deployCommand as any)
  .command(installCommand) // allow install to run from the top as well as repo
  .command(repoCommand)
  .command(testCommand)
  .command(docsCommand)
  .command(metadataCommand)
  .command(docgenCommand)
  .command(pullCommand)
  // Common options
  .option('log', {
    alias: ['l'],
    description: 'Set the default log level to none, default, info or debug',
    array: true,
  })
  .option('log-json', {
    description: 'Output all logs as JSON objects',
    boolean: true,
  })
  .example('openfn execute help', 'Show documentation for the execute command')
  .example(
    'openfn docs @openfn/language-common each',
    'Get more help on the common.each command'
  )
  .command({
    command: 'version',
    handler: (argv: Arguments<Opts>) => {
      argv.command = 'version';
    },
  })
  .wrap(y.terminalWidth())
  .help() as yargs.Argv<Opts>;
