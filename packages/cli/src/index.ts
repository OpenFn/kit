#!/usr/bin/env node
import runInChildProcess from './process/spawn';
import { cmd } from './cli';
import { Opts } from './commands';

type YargsOpts = Opts & { 
  path: string;
  _: string[];
}
const opts = cmd.parse() as YargsOpts;

// If all inputs have parsed OK, we can go ahead and run in a child process
runInChildProcess(opts._[0], opts);