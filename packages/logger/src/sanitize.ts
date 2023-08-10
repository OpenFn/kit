import stringify from 'fast-safe-stringify';

export const SECRET = '****';

type SanitizeOptions = {
  stringify?: boolean; // true by default

  sanitizePaths?: string[]; // unimplemented
};

// Sanitize console output
const sanitize = (item: any, options: SanitizeOptions = {}) => {
  // Stringify output to ensure we show deep nesting
  const maybeStringify = (o: any) =>
    options.stringify === false ? o : stringify(o, undefined, 2);

  if (item instanceof Error) {
    return item;
  }

  if (
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
export const replaceObject = (
  replace: string | ((logItem: any) => string),
  ...logItem: any[]
): any[] =>
  logItem.map((i: any) => {
    if (isObject(i) || Array.isArray(i)) {
      return typeof replace === 'function' ? replace(i) : replace;
    }
    return i;
  });

// sanitize policy subject to options

// remove all objects from the output
// Note that we should refuse to log if there is nothign left
// does that mean the logger never logs null?
export const remove = (logItem) => {
  // TODO incoming is an argument to console.log
};

// // summarise the object
// // ie, array with 31 items or object with keys z, y, x
// const summarise = (logItem) => {};

// // [object Object] or Array<Object>
const obfuscate = (logItem) => {};

export default sanitize;
