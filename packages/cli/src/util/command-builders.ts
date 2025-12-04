import yargs, { ArgumentsCamelCase } from 'yargs';
import c from 'chalk';

import { CommandList } from '../commands';
import type { Opts, CLIOption } from '../options';

const expandYargs = (y: {} | (() => any)) => {
  if (typeof y === 'function') {
    return y();
  }
  return y;
};

// build helper to chain options
export function build(opts: CLIOption[], yargs: yargs.Argv<any>) {
  return opts.reduce(
    (_y, o) => yargs.option(o.name, expandYargs(o.yargs)),
    yargs
  );
}

// Mutate the incoming argv with defaults etc
export const ensure =
  (command: CommandList, opts: CLIOption[]) =>
  (yargs: ArgumentsCamelCase<Partial<Opts>>) => {
    yargs.command = command;
    opts
      .filter((opt) => opt.ensure)
      .forEach((opt) => {
        try {
          opt.ensure!(yargs);
        } catch (e) {
          console.log(e);
          console.error(
            c.red(`\nError parsing command arguments: ${command}.${opt.name}\n`)
          );
          console.error(c.red('Aborting'));
          console.error();
          process.exit(9); // invalid argument
        }
      });
  };

// override yargs properties for a command
// (a better pattern than the functions)
export const override = (command: CLIOption, yargs: CLIOption['yargs']) => {
  return {
    ...command,
    yargs: {
      ...(command.yargs || {}),
      ...yargs,
    },
  };
};
