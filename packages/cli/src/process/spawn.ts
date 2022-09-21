/**
 * Utility to run CLI commands inside a child process
 * This lets us hide the neccessary arguments needed to run our devtools
 */
import path from 'node:path';
import * as url from 'url';
import { fork } from "node:child_process";
import type { Opts } from '../commands';

// The default export will create a new child process which calls itself
export default function (basePath: string, opts: Opts) {
  const execArgv = [
    // Suppress experimental argument warnings
    '--no-warnings',

    // Allows us to load an ESM module from a text string
    '--experimental-vm-modules',

    // Allows us to do import('path/to/language-common') in the linker
    '--experimental-specifier-resolution=node',
  ];
  
  const dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const child = fork(`${dirname}/process/child-process.js`, [], { execArgv });

  child.on('message', ({ done }: { done: boolean}) => {
    if (done) {
      child.kill();
      process.exit(0)
    }
  })
  child.send({ basePath, opts })
};

