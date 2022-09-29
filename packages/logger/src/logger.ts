import c from 'chalk';
import figures from 'figures';

type LogArgs = any[];

type LogLevel = 'debug' | 'trace' | 'info' | 'warn' | 'error' | 'success';

export const DEBUG = 'debug';
export const TRACE = 'trace';
export const INFO = 'info';
export const WARN = 'warn';
export const ERROR = 'error';
export const SUCCESS = 'success';

const priority = {
  [DEBUG]: 0,
  [TRACE]: 0,
  [INFO] : 1,
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

type LogOptions = {
  silent?: boolean;
  level?: LogLevel;

  // TODO how can we duplicate the custom logger, so we do a standard log AND something else (eg http log)
  logger?: typeof console; // a log object, allowing total override of the output#

  hideNamespace?: boolean;
  hideIcons?: boolean;

  // terrible name... when two logs of different types are side by side
  // stick an empty line between
  breakUpTypes?: boolean;

  // TODO if the output extends beyond the screenwith, wrap a bit
  //      just enough to avoid the [type][level] column (like this comment)
  wrap?: boolean

}

type Logger = typeof console;

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

const defaultEmitter = {
  ...console,
  success: (...args) => console.log(...args)
}

// This reporter should previx all logs with the logger name
// It should also handle grouping
export default function(name?: string, options?: LogOptions = {}): Logger {
  const minLevel = priority[options.level ?? INFO];

  // This is what we actually pass the log strings to
  const emitter = options.logger || defaultEmitter;

  // main logger function
  const log = (level: LogLevel, ...args: LogArgs) => {
    const output = [];

    if (name && !options.hideNamespace) {
      // TODO how can we fix the with of the type column so that things
      //      are nicely arranged in the CLI?
      output.push(c.blue(`[${name}]`));
    }
    if (!options.hideIcons) {
      output.push(styleLevel(level))
    }

    output.push(...args)
    // concatenate consecutive strings
    // log objects by themselves, pretty printed

    // TODO I'd really really like a nice way to visualise log('state': hugeJsonObject)
    // This will take some effort I think
    
    // how do we actually log?
    if (!options.silent && priority[level] >= minLevel) {
      if (emitter[level]) {
        emitter[level](...output)
      }
    }
  };

  const wrap = (level: LogLevel) => (...args: LogArgs) => log(level, ...args);

  const logger = function(...args: LogArgs) {
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

