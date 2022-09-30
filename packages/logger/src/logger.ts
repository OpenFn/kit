import c from 'chalk';
import figures from 'figures';
import parseOptions from './options';

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

export const WARN = 'warn'; // TODO remove (this is success)
export const ERROR = 'error'; // TODO remove (this is success)
export const TRACE = 'trace'; // TODO remove (this is debug)

const priority = {
  [DEBUG]: 0,
  [INFO] : 1,
  'default': 2,
  [NONE] : 9,

  // TODO remove all this
  [TRACE]: 0,
  [WARN] : 2,
  [ERROR]: 2,
  [SUCCESS] : 2,
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
export const styleLevel = (level: LogLevel) => {
  switch (level) {
    case ERROR:
      return c.red(figures.cross);
    case WARN:
      return c.yellow(figures.warning);
    case SUCCESS:
      return c.green(figures.tick);
    case DEBUG:
    case TRACE:
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
export default function(name?: string, options: NamespacedOptions = {}): Logger {
  const opts = parseOptions(options, name);
  const minLevel = priority[opts.level];

  // This is what we actually pass the log strings to
  const emitter = opts.logger;

  // main logger function
  const log = (level: LogLevel, ...args: LogArgs) => {
    if (level === NONE) return;

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

  const wrap = (level: LogLevel) => (...args: LogArgs) => log(level, ...args);

  // TODO remove this, it's not clear what level it will log to
  const logger = function(...args: LogArgs) {
    console.warn("WARNING: deprecated call to logger()")
    log(INFO, ...args);
  };

  logger[INFO] = wrap(INFO);
  logger[DEBUG] = wrap(DEBUG);
  logger[TRACE] = wrap(DEBUG); // Note trace deliberately maps to debug!
  logger[ERROR] = wrap(ERROR);
  logger[WARN] = wrap(WARN);
  logger[SUCCESS] = wrap(SUCCESS);

  logger.log = wrap(INFO);

  // possible convenience APIs
  logger.force = () => {} // force the next lines to log (even if silent)
  logger.unforce = () => {} // restore silent default
  logger.break = () => { console.log() } // print a line break
  logger.indent = (spaces: 0) => {} // set the indent level

  return logger as Logger;
}

