#!/usr/bin/env node
import runInChildProcess from './process/spawn';
import { cmd } from './cli';
import { Opts } from './commands';

type YargsOpts = Opts & {
  path: string;
  _: string[];
};
const opts = cmd.parse() as YargsOpts;
runInChildProcess(opts._[0], opts);
