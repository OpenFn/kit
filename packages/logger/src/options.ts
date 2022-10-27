export type LogLevel = 'debug' | 'info' | 'default' | 'none';

export type LogEmitter = typeof console & { success: typeof console.log };

export type LogOptions = {
  level?: LogLevel;

  // a log object, allowing total override of the output#
  logger?: LogEmitter;

  hideNamespace?: boolean;
  hideIcons?: boolean;

  // TODO if the output extends beyond the screenwith, wrap a bit
  //      just enough to avoid the [type][level] column (like this comment)
  wrap?: boolean;

  // or is this a terminal concern?
  showTimestamps?: boolean;

  // paths to stuff in the state object we should obfuscate
  // this should work with language adaptors
  // like if we on sensitive c in a.b.c, console.log(c) should
  sanitizePaths?: string[];

  sanitiseState?: boolean; // defaults to true
  detectState?: boolean; // defaults to true
};

// TODO not crazy about the handling of this
// but to support the success handler we need to alias console.log
const defaultEmitter = {
  ...console,
  success: (...args: any[]) => console.log(...args),
};

export const defaults: Required<LogOptions> = {
  level: 'default',
  // TODO support an array of emitters here
  logger: defaultEmitter, // I guess?

  hideNamespace: false,
  hideIcons: false,

  // Not implemented
  wrap: false,
  showTimestamps: false,
  sanitiseState: false,
  detectState: false,
  sanitizePaths: ['configuration'],
};

// This will return a fully defined options object
const parseOptions = (opts: LogOptions = {}): Required<LogOptions> => {
  // First default all values
  const options = {
    ...defaults,
    ...opts,
  };

  // TODO handle merging of arrays (ie sensitive paths)
  // Maybe, this is actually a non trivial issue
  // If the user sets a path list, is this an override or extension?
  // Let's make it an extension

  // Let's hard-code config sanitizing, then take an array of extra paths

  return options;
};

export default parseOptions;
