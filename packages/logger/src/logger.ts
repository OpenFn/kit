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

type LogOptions = {
  silent?: boolean;
  level?: number;
  logger?: typeof console; // a log object, allowing total override of the output
}

// import BasicReporter from 'consola/basic'

// This reporter should previx all logs with the logger name
// It should also handle grouping
export default function(name: string, options: LogOptions = {}) {
  const minLevel = priority[options.level ?? INFO];

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

  return logger;
}

