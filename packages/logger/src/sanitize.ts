import stringify from 'fast-safe-stringify';
import { isObject, isArray } from './util';

export const SECRET = '****';

export type SanitizePolicies = 'remove' | 'obfuscate' | 'summarize' | 'none';

type SanitizeOptions = {
  stringify?: boolean; // true by default

  sanitizePaths?: string[]; // unimplemented

  // sanitisation policies (by default do nothing)
  // TODO throw if an invalid policy is passed
  // This is potentially important so we do want to break
  // but! we should throw in the CLI< not here.
  policy?: SanitizePolicies;
};

const scrubbers: Record<SanitizePolicies, (item: any) => any> = {
  remove,
  obfuscate,
  summarize,
  none: (item) => item,
};

// Sanitize console output
const sanitize = (item: any, options: SanitizeOptions = {}) => {
  // Stringify output to ensure we show deep nesting
  const maybeStringify = (o: any) =>
    options.stringify === false ? o : stringify(o, undefined, 2);

  if (item instanceof Error) {
    return item;
  }

  if (options.policy?.match(/^(remove|obfuscate|summarize)$/)) {
    return scrubbers[options.policy](item);
  } else if (
    Array.isArray(item) ||
    (isNaN(item) && item && typeof item !== 'string')
  ) {
    const obj = item as Record<string, unknown>;
    if (obj && obj.configuration) {
      // This looks sensitive, so let's sanitize it
      const configuration = {} as Record<string, unknown>;
      for (const k in obj.configuration) {
        configuration[k] = SECRET;
      }
      const cleaned = maybeStringify({
        ...obj,
        configuration,
      });
      return cleaned;
    }
    return maybeStringify(obj);
  }
  return item;
};

// Sanitize helpers

// Replace objects and arrays with null
function remove(logItem: any): any {
  if (isObject(logItem) || isArray(logItem)) {
    return null;
  }

  return logItem;
}

// summarise the object
// ie, array with 31 items or object with keys z, y, x
function summarize(logItem: any): any {
  if (isArray(logItem)) {
    if (logItem.length) {
      return `(array with ${logItem.length} items)`;
    } else {
      return '(empty array)';
    }
  }
  if (isObject(logItem)) {
    const keys = Object.keys(logItem);
    if (keys.length) {
      return `(object with keys ${keys.sort().join(', ')})`;
    } else {
      return '(empty object)';
    }
  }
  return logItem;
}

// obfuscate an object or array with a simple string
function obfuscate(logItem: any): any {
  if (isArray(logItem)) {
    return '[array]';
  }
  if (isObject(logItem)) {
    return '[object]';
  }
  return logItem;
}

export default sanitize;
