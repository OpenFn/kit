import stringify from 'fast-safe-stringify';

export const SECRET = '****';

type SanitizePolicies = 'remove' | 'obfuscate' | 'summarize' | 'none';

type SanitizeOptions = {
  stringify?: boolean; // true by default

  sanitizePaths?: string[]; // unimplemented

  // sanitisation policies (by default do nothing)
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

// TODO move to utils
// Also create isArray,which will just be a shallow clone
export const isObject = (thing: any) => {
  if (Array.isArray(thing) || thing === null || thing instanceof Error) {
    return false;
  }

  if (typeof thing === 'object') {
    return true;
  }
  return false;
};

// replace an object with a string or the result of a function
// But this affects arrays as well, argh
// TODO is this actually pointless now that we only take a singletone argument?
export const replaceObject = (
  replace: string | ((logItem: any) => string),
  logItem: any
): any => {
  if (isObject(logItem) || Array.isArray(logItem)) {
    return typeof replace === 'function' ? replace(logItem) : replace;
  }
  return logItem;
};

// sanitize policy subject to options

// remove all objects from the output
// Note that we should refuse to log if there is nothing left
// does that mean the logger never logs null?
function remove(logItem: any): any {
  // TODO incoming is an argument to console.log
  if (isObject(logItem)) {
    return null;
  } else if (Array.isArray(logItem)) {
    // TODO if we find an array, I think we should remove all the objects inside?
    // Or do we just remove the whole thing?
    return logItem.map(remove);
  }

  return logItem;
}

// // summarise the object
// // ie, array with 31 items or object with keys z, y, x
function summarize(logItem: any): any {
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

// // [object Object] or Array<Object>
function obfuscate(logItem: any): any {
  if (Array.isArray(logItem)) {
    return '[array]';
  }
  if (isObject(logItem)) {
    return '[object]';
  }
  return logItem;
}

export default sanitize;
