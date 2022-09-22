// Is this really just an interface?

type LoggerOptions = {
  level: 'trace' | 'log' | 'warn' | 'error' | 'none';
  // not useful in local dev but useful in cli
  showTimestamps: boolean;

  sanitiseState: boolean; // defaults to true
  detectState: boolean; // defaults to true

  // paths to stuff in the state object we should obfuscate
  // this should work with language adaptors
  // like if we on sensitive c in a.b.c, console.log(c) should 
  sensitivePaths: string[];

  // groups outout with indents
  // standalone runtimes probably don't want to do this
  // runtime managers probably do want it though
  useGroups: boolean
}

// Design for a logger
// some inputs:
// This will be passed into a job, so must look like the console object
// will be used by default by compiler and runtime
interface Logger {
  constructor(name: string);

  // standard log functions
  log();
  info();
  warn();
  error();
  trace();

  // fancier log functions
  group();
  groupEnd();
  time();
  timeEnd()

  // special log functions
  state() // output a state object

  // internals, so not part of the interface
   
}