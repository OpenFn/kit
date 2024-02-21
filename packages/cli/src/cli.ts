import yargs, { Arguments } from 'yargs';
import { hideBin } from 'yargs/helpers';

import compileCommand from './compile/command';
import deployCommand from './deploy/command';
import docgenCommand from './docgen/command';
import docsCommand from './docs/command';
import executeCommand from './execute/command';
import generateCommand from './generate/command';
import metadataCommand from './metadata/command';
import pullCommand from './pull/command';
import { Opts } from './options';
import { install as installCommand, repo as repoCommand } from './repo/command';
import testCommand from './test/command';

const y = yargs(hideBin(process.argv));

export const cmd = y
  // TODO Typescipt hacks because signatures don't seem to align
  .command(executeCommand as any)
  .command(compileCommand)
  .command(deployCommand as any)
  .command(installCommand) // allow install to run from the top as well as repo
  .command(repoCommand)
  .command(testCommand)
  .command(docsCommand)
  .command(metadataCommand as any)
  .command(docgenCommand as any)
  .command(pullCommand as any)
  .command(generateCommand as any)
  .command({
    command: 'version',
    describe:
      'Show the currently installed version of the CLI, compiler and runtime.',
    handler: (argv: Arguments<Partial<Opts>>) => {
      argv.command = 'version';
    },
  })
  .wrap(y.terminalWidth())
  .help() as yargs.Argv<Opts>;
