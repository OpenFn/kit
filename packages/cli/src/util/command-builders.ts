import yargs from 'yargs';
import { CommandList } from '../commands';
import type { Opts, CLIOption } from '../options';

const expandYargs = (y: {} | (() => any)) => {
  if (typeof y === 'function') {
    return y();
  }
  return y;
};

// build helper to chain options
export const build = (opts: CLIOption[], yargs: yargs.Argv) =>
  opts.reduce((_y, o) => yargs.option(o.name, expandYargs(o.yargs)), yargs);

// Mutate the incoming argv with defaults etc
export const ensure =
  (command: CommandList, opts: CLIOption[]) => (yargs: Opts) => {
    yargs.command = command;
    opts
      .filter((opt) => opt.ensure)
      .forEach((opt) => {
        opt.ensure!(yargs);
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
