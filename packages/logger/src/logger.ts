import c from 'chalk';
import iconfirm from '@inquirer/confirm';
import stringify from 'fast-safe-stringify';
import * as symbols from './symbols';
import sanitize from './sanitize';
import getDurationString from './util/duration';
import ensureOptions, { LogOptions, LogLevel } from './options';

// Nice clean log level definitions

// Don't log anything at all (good for unit tests)
// (Note that this doesn't stop a component printing to stdout! It just disables the logger)
export const NONE = 'none';

// Defaults for all the family. Prints what the user absolutely has to know.
// Top-level completions, errors and warnings
export const SUCCESS = 'success'; // aka default

// For power users. Success + generally interesting high-level information about what's happening.
// Ie, operations starting, compiler changes
export const INFO = 'info';

// For devs debugging - really detailed output about stepping into and out of major operations.
// includes lots of data dumps
export const DEBUG = 'debug';

export const ERROR = 'error';

export const WARN = 'warn';

export type LogArgs = any[];

// TODO something is wrong with these typings
// Trying to differentiate user priority presets from log functions
export type LogFns = 'debug' | 'info' | 'log' | 'warn' | 'error' | 'success';

export type JSONLog = {
  message: Array<string | object | any>;
  level: LogFns;
  name?: string;
  time: number;
};

export type StringLog = [LogFns | 'confirm' | 'print', ...any];

// Design for a logger
// some inputs:
// This will be passed into a job, so must look like the console object
// will be used by default by compiler and runtime
export interface Logger extends Console {
  constructor(name: string): Logger;

  options: Required<LogOptions>;

  // standard log functions
  log(...args: any[]): void;
  info(...args: any[]): void;
  debug(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  success(...args: any[]): void;

  // fancier log functions
  print(...args: any[]): void;
  confirm(message: string, force?: boolean): Promise<boolean>;
  timer(name: string): string | undefined;
  break(): void;
  // group();
  // groupEnd();
  // time();
  // timeEnd()

  // special log functions
  // state() // output a state object
}

// Typing here is a bit messy because filter levels and function levels are conflated
const priority: Record<LogFns | LogLevel, number> = {
  [DEBUG]: 0,
  [INFO]: 1,
  log: 1,
  default: 2,
  [WARN]: 2,
  [ERROR]: 2,
  [SUCCESS]: 2,
  [NONE]: 9,
};

// // TODO I'd quite like each package to have its own colour, I think
// // that would be a nice branding exercise, even when running standalone
// const colors = {
//   'Compiler': 'green', // reassuring green
//   'Runtime': 'pink', // cheerful pink
//   'Job': 'blue', // businesslike blue

//   // default to white I guess
// }

// TODO what if we want to hide levels?
// OR hide some levels?
// Or customise the display?
// TODO use cool emojis
export const styleLevel = (level: LogFns) => {
  switch (level) {
    case ERROR:
      return c.red(symbols.cross);
    case WARN:
      return c.yellow(symbols.warning);
    case SUCCESS:
      return c.green(symbols.tick);
    case DEBUG:
      return c.grey(symbols.pointer);
    default:
      return c.white(symbols.info);
  }
};

// This reporter should prefix all logs with the logger name
// It should also handle grouping
// The options object should be namespaced so that runtime managers can pass a global options object
// to each logger. Seems counter-intuitive but it should be much easier!
// TODO allow the logger to accept a single argument
export default function (name?: string, options: LogOptions = {}): Logger {
  const opts = ensureOptions(options) as Required<LogOptions>;
  const minLevel = priority[opts.level];

  // This is what we actually pass the log strings to
  const emitter = opts.logger;

  const log = (level: LogFns, ...args: LogArgs) => {
    if (priority[level] >= minLevel) {
      if (options.json) {
        logJSON(level, ...args);
      } else {
        logString(level, ...args);
      }
    }
  };

  const logJSON = (level: LogFns, ...args: LogArgs) => {
    const output: JSONLog = {
      level,
      name,
      message: args.map((o) => sanitize(o, { stringify: false })),
      time: Date.now(),
    };

    stringify(output);
    emitter[level](stringify(output));
  };

  const logString = (level: LogFns, ...args: LogArgs) => {
    if (emitter.hasOwnProperty(level)) {
      const output = [];

      if (name && !opts.hideNamespace) {
        // TODO how can we fix the with of the type column so that things
        //      are nicely arranged in the CLI?
        output.push(c.blue(`[${name}]`));
      }
      if (!opts.hideIcons) {
        output.push(styleLevel(level));
      }

      output.push(...args);

      const cleaned = output.map((o) => sanitize(o, options));
      emitter[level](...cleaned);
    }
  };

  // print() will log without any metadata/overhead/santization
  // basically a proxy for console.log
  const print = (...args: any[]) => {
    if (opts.level !== NONE) {
      if (opts.json) {
        emitter.info(JSON.stringify({ message: args }));
      } else {
        emitter.info(...args);
      }
    }
  };

  const confirm = async (message: string, force = false) => {
    if (force) {
      return true;
    }
    return iconfirm({ message });
  };

  const timers: Record<string, number> = {};

  /**
   * Toggle to start and end a timer
   * If a timer is ended,returns a nicely formatted duration string
   */
  const timer = (name: string) => {
    if (timers[name]) {
      const startTime = timers[name];
      delete timers[name];
      return getDurationString(new Date().getTime() - startTime);
    }
    timers[name] = new Date().getTime();
  };

  const wrap =
    (level: LogFns) =>
    (...args: LogArgs) =>
      log(level, ...args);

  // TODO this does not yet cover the full console API
  const logger = {
    info: wrap(INFO),
    log: wrap(INFO),
    debug: wrap(DEBUG),
    error: wrap(ERROR),
    warn: wrap(WARN),
    success: wrap(SUCCESS),
    confirm,
    timer,
    print,

    // possible convenience APIs
    force: () => {}, // force the next lines to log (even if silent)
    unforce: () => {}, // restore silent default
    // print a line break
    break: () => {
      console.log();
    },
    indent: (_spaces: 0) => {}, // set the indent level

    options: opts, // debug and testing
  } as unknown; // type shenanegans

  return logger as Logger;
}
