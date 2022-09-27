import c from 'chalk';

type LogArgs = any[];

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const DEBUG = 'debug';
const INFO = 'info';
const WARN = 'warn';
const ERROR = 'error';

const priority = {
  [DEBUG]: 0,
  [INFO] : 1,
  [WARN] : 2,
  [ERROR]: 3,
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
  level?: number;

  // TODO how can we duplicate the custom logger, so we do a standard log AND something else (eg http log)
  logger?: typeof console; // a log object, allowing total override of the output#


  // terrible name... when two logs of different types are side by side
  // stick an empty line between
  breakUpTypes: boolean;

  // TODO if the output extends beyond the screenwith, wrap a bit
  //      just enough to avoid the [type][level] column (like this comment)
  wrap: boolean

}

// import BasicReporter from 'consola/basic'

// This reporter should previx all logs with the logger name
// It should also handle grouping
export default function(name: string, options: LogOptions = {}) {
  const minLevel = priority[options.level ?? INFO];

  // TODO what if we want to hide levels?
  // OR hide some levels?
  // Or customise the display?
  // TODO use cool emojis
  const styleLevel = (level: LogLevel) => {
    switch (level) {
      case ERROR:
        return c.red('[E]')
      case WARN:
        return c.yellow('[W]')
      case DEBUG:
        return c.gray('[d]')
      default:
        return c.white('[i]')
    }
  }

  // This is what we actually pass the log strings to
  const emitter = options.logger || console;

  // main logger function
  const log = (level: LogLevel, ...args: LogArgs) => {
    const output = [
      // TODO how can we fix the with of the type column so that things
      //      are nicely arranged in the CLI?
      c.blue(`[${name}]`),
      styleLevel(level)
    ]
    output.push(...args)
    // concatenate consecutive strings
    // log objects by themselves, pretty printed

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
  logger[ERROR] = wrap(ERROR);
  logger[WARN] = wrap(WARN);

  logger.log = wrap(INFO);

  // possible convenience APIs
  logger.force = () => {} // force the next lines to log (even if silent)
  logger.unforce = () => {} // restore silent default
  logger.break = () => {} // print a line break
  logger.indent = (spaces: 0) => {} // set the indent level

  return logger;
}

