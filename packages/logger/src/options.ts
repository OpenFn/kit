// TODO not crazy about the handling of this
// but to support the success handler we need to alias console.log
const defaultEmitter = {
  ...console,
  success: (...args: any[]) => console.log(...args)
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
  sensitivePaths: ['configuration'],
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

  return options;
}

export default parseOptions;