import yargs from 'yargs';
import * as o from '../options';
import type { Opts } from '../options';
import { build, ensure } from '../util/command-builders';

export type TestOptions = Pick<Opts, 'stateStdin' | 'log' | 'logJson'>;

const options = [o.stateStdin, o.log, o.logJson];

export default {
  command: 'test',
  desc: 'Compiles and runs a test job, printing the result to stdout',
  handler: ensure('test', options),
  builder: (yargs) =>
    build(options, yargs).example('test', 'Run the test script'),
} as yargs.CommandModule<{}>;
