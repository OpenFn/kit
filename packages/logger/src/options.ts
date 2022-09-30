// TODO not crazy about the handling of this
const defaultEmitter = {
  ...console,
  success: (...args) => console.log(...args)
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

// This will return a fully defined options object with defaults and namespace-specific overrides
const parseOptions = (opts: NamespacedOptions  = {}, name: string = 'global'): Required<LogOptions> => {
  // First default all values
  const options = {
    ...defaults
  };

  // Then look to see if there are any overrides for the namespace
  const namespaced = opts[name];
  if (namespaced) {
    Object.assign(options, namespaced);
  }

  return options;
}

export default parseOptions;