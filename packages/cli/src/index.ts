#!/usr/bin/env node
import runInChildProcess from './process/spawn';
import { cmd } from './cli';

const opts = cmd.parseSync();
runInChildProcess(opts);
