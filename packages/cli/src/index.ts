#!/usr/bin/env node
import runInChildProcess from './process/spawn';
import { cmd } from './cli';
import { Opts } from './options';

type YargsOpts = Opts & {
  path: string;
  _: string[];
};
// TODO messy typings here
const opts = cmd.parse() as unknown as YargsOpts;
runInChildProcess(opts.path, opts);
