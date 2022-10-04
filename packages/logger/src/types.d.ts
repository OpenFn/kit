
type LogArgs = any[];

// TODO something is wrong with these typings
// Trying to differntite user priority presets from log functions
type LogFns = 'debug' | 'info' | 'log' | 'warn' | 'error' | 'success';

type LogLevel = 'debug' | 'info' | 'default' | 'none';

type LogOptions = {
  level?: LogLevel;

  // TODO how can we duplicate the custom logger, so we do a standard log AND something else (eg http log)
  logger?: typeof console; // a log object, allowing total override of the output#

  hideNamespace?: boolean;
  hideIcons?: boolean;

  // TODO if the output extends beyond the screenwith, wrap a bit
  //      just enough to avoid the [type][level] column (like this comment)
  wrap?: boolean
  
  // or is this a terminal concern?
  showTimestamps?: boolean;
  
  // paths to stuff in the state object we should obfuscate
  // this should work with language adaptors
  // like if we on sensitive c in a.b.c, console.log(c) should 
  sensitivePaths?: string[];

  sanitiseState?: boolean; // defaults to true
  detectState?: boolean; // defaults to true
}

// Design for a logger
// some inputs:
// This will be passed into a job, so must look like the console object
// will be used by default by compiler and runtime
interface Logger extends Console {
  constructor(name: string);

  options: Required<LogOptions>;

  // standard log functions
  log(...args: any[]): void;
  info(...args: any[]): void;
  debug(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  success(...args: any[]): void;

  // fancier log functions
  group();
  groupEnd();
  time();
  timeEnd()

  // special log functions
  state() // output a state object

  // internals, so not part of the interface
   
}
