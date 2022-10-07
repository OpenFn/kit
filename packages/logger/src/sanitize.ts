// Sanitize (but don't prettify) console output

import { LogOptions } from "./options";

export const SECRET = '****';

// Node itself does a good job of circular references and functions
const sanitize = (item: string | object, _options: Pick<LogOptions, 'sanitizePaths'> = {}) => {
  // TODO what if the object contains functions?
  if (typeof item !== "string") {
    const obj = item as Record<string, unknown>;
    if (obj.data && obj.configuration) {
      // This is a state object, so let's sanitize it
      const cleanConfig = {} as Record<string, unknown>;;
      for(const k in obj.configuration) {
        cleanConfig[k] = SECRET;
      }
      const cleaned = {
        configuration: cleanConfig,
        data: obj.data,
      }
      return cleaned;
    }
    // TODO I am less sure how to handle non-state objects
    // I guess we just handle user provided json paths?
  }
  return item;
}

export default sanitize;