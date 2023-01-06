/**
 * Utility to run CLI commands inside a child process
 * This lets us hide the neccessary arguments needed to run our devtools
 */
import path from 'node:path';
import * as url from 'url';
import { fork } from 'node:child_process';
import process from 'node:process';
import type { Opts } from '../commands';

type Messages = { done?: boolean; init?: boolean; exitCode?: number };

// The default export will create a new child process which calls itself
export default function (basePath: string, opts: Opts) {
  const execArgv = [
    // Suppress experimental argument warnings
    '--no-warnings',

    // Allows us to load an ESM module from a text string
    '--experimental-vm-modules',
  ];

  const dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const child = fork(`${dirname}/process/runner.js`, [], { execArgv });

  child.on('message', ({ done, init, exitCode }: Messages) => {
    if (init) {
      child.send({ init: true, basePath, opts });
    }

    if (done) {
      child.kill();
      process.exit(exitCode);
    }
  });

  child.on('close', (code: number) => {
    process.exitCode = code;
  });
}
