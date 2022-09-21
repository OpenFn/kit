#!/usr/bin/env node
import runInChildProcess from './process/spawn';
import { cmd } from './cli';
import { Opts } from './commands';

type YargsOpts = Opts & { 
  path: string;
  _: string[];
}
const opts = cmd.parse() as YargsOpts;
const basePath = opts._[0];
if (basePath) {
  // If all inputs have parsed OK, we can go ahead and run in a child process
  runInChildProcess(basePath, opts);
} else {
  console.error('ERROR: no path provided!');
  console.error('\nUsage:');
  console.error('  open path/to/job.js');
  console.error('\nFor more help do:');
  console.error('  openfn --help ');
}