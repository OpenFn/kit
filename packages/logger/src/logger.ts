import c from 'chalk';
import figures from 'figures';
import ensureOptions from './options';

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

const priority = {
  [DEBUG]: 0,
  [INFO] : 1,
  'default': 2,
  [WARN] : 2,
  [ERROR]: 2,
  [SUCCESS] : 2,
  [NONE] : 9,
};

// TODO I'd quite like each package to have its own colour, I think
// that would be a nice branding exercise, even when running standalone
const colors = {
  'Compiler': 'green', // reassuring green
  'Runtime': 'pink', // cheerful pink
  'Job': 'blue', // businesslike blue

  // default to white I guess
}


// TODO what if we want to hide levels?
// OR hide some levels?
// Or customise the display?
// TODO use cool emojis
export const styleLevel = (level: LogFns) => {
  switch (level) {
    case ERROR:
      return c.red(figures.cross);
    case WARN:
      return c.yellow(figures.warning);
    case SUCCESS:
      return c.green(figures.tick);
    case DEBUG:
      return c.grey(figures.pointer);
    default:
      return c.white(figures.info);
  }
}

// This reporter should prefix all logs with the logger name
// It should also handle grouping
// The options object should be namespaced so that runtime managers can pass a global options object
// to each logger. Seems counter-intuitive but it should be much easier!
// TODO allow the logger to accept a single argument
export default function(name?: string, options: LogOptions = {}): Logger {
  const opts = ensureOptions(options);
  const minLevel = priority[opts.level];

  // This is what we actually pass the log strings to
  const emitter = opts.logger;

  // main logger function
  const log = (level: LogFns, ...args: LogArgs) => {
    if (opts.level === NONE) return;

    const output = [];

    if (name && !opts.hideNamespace) {
      // TODO how can we fix the with of the type column so that things
      //      are nicely arranged in the CLI?
      output.push(c.blue(`[${name}]`));
    }
    if (!opts.hideIcons) {
      output.push(styleLevel(level))
    }

    output.push(...args)
    // concatenate consecutive strings
    // log objects by themselves, pretty printed

    // TODO I'd really really like a nice way to visualise log('state': hugeJsonObject)
    // This will take some effort I think
    
    // how do we actually log?
    if (priority[level] >= minLevel) {
      if (emitter[level]) {
        emitter[level](...output)
      }
    }
  };

  const wrap = (level: LogFns) => (...args: LogArgs) => log(level, ...args);

  const logger = {
    info: wrap(INFO),
    log: wrap(INFO),
    debug: wrap(DEBUG),
    error: wrap(ERROR),
    warn: wrap(WARN),
    success: wrap(SUCCESS),

    // possible convenience APIs
    force: () => {}, // force the next lines to log (even if silent)
    unforce: () => {}, // restore silent default
    break: () => { console.log() }, // print a line break
    indent: (spaces: 0) => {}, // set the indent level
  };

  return logger as Logger;
}

