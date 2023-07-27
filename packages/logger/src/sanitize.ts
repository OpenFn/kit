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

export default sanitize;
