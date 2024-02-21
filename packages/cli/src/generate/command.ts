import yargs from 'yargs';
import * as o from '../options';
import type { Opts } from '../options';
import { build, ensure } from '../util/command-builders';

export type TestOptions = Pick<Opts, 'stateStdin' | 'log' | 'logJson'>;

const options = [o.log, o.logJson, o.useAdaptorsMonorepo, o.outputPath];

options.push({
  name: 'adaptor',
  yargs: {
    description: 'The name of the adaptor to generate',
  },
} as o.CLIOption);

// Adaptor generation subcommand
const adaptor = {
  command: 'adaptor',
  desc: 'Generate adaptor code',
  handler: ensure('generate-adaptor', options),
  builder: (yargs) =>
    build(options, yargs)
      .example(
        'generate adaptor ./spec.json',
        'Generate adaptor code based on spec.json'
      )
      .positional('path', {
        describe: 'The path spec.json',
        demandOption: true,
      }),
} as yargs.CommandModule<{}>;

export default {
  command: 'generate [subcommand]',
  desc: 'Generate code (only adaptors supported now)',
  handler: () => {
    // TODO: better error handling
    console.error('ERROR: invalid command');
    console.error('Try:\n\n  openfn generate adaptor\n');
  },
  builder: (yargs: yargs.Argv) =>
    yargs
      .command(adaptor)
      .example(
        'generate adaptor ./spec.json',
        'Generate adaptor code based on spec.json'
      ),
} as yargs.CommandModule<{}>;
