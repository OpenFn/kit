// Sanitize console output
import stringify from 'fast-safe-stringify';

import { LogOptions } from './options';

export const SECRET = '****';

// Node itself does a good job of circular references and functions
const sanitize = (
  item: any,
  _options: Pick<LogOptions, 'sanitizePaths'> = {}
) => {
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
      const cleaned = stringify({
        ...obj,
        configuration,
      });
      return cleaned;
    }
    return stringify(obj);
  }
  return item;
};

export default sanitize;
