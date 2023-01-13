// Sanitize console output
import stringify from 'fast-safe-stringify';
export const SECRET = '****';

type SanitizeOptions = {
  stringify?: boolean;

  sanitizePaths?: string[]; // unimplemented
};

// Node itself does a good job of circular references and functions
const sanitize = (item: any, options: SanitizeOptions = {}) => {
  const maybeStringify = (o: any) =>
    options.stringify === false ? o : stringify(o);

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
