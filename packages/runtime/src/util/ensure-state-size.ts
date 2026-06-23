import { JsonStreamStringify } from 'json-stream-stringify';
import { StateTooLargeError } from '../errors';
import { Logger } from '@openfn/logger';

const replacer = (_key: string, value: any) => {
  // Ignore non serializable keys
  if (
    value === undefined ||
    typeof value === 'function' ||
    value?.constructor?.name === 'Promise'
  ) {
    return undefined;
  }

  return value;
};

// throws if state exceeds a particular size limit
export default async (value: any, limit_mb: number = 500, logger?: Logger) => {
  if (value && !isNaN(limit_mb) && limit_mb > 0) {
    const limitBytes = limit_mb * 1024 * 1024;
    let size_bytes = 0;
    const stream = new JsonStreamStringify(value, replacer, 0, true);
    for await (const chunk of stream) {
      // Each chunk is a string token from the JSON output
      size_bytes += Buffer.byteLength(chunk, 'utf8');

      if (size_bytes > limitBytes) {
        logger?.info(
          `state object exceeds limit ${limit_mb} (${
            size_bytes / 1024 / 1024
          }mb)`
        );
        throw new StateTooLargeError(limit_mb);
      }
    }
    if (size_bytes < 1024 * 1024) {
      logger?.debug(`State object serializes to less than 1mb`);
    } else {
      logger?.debug(
        `State object serializes to ${(size_bytes / 1024 / 1024).toFixed(2)}mb`
      );
    }
  }
};
