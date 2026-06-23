import { JsonStreamStringify } from 'json-stream-stringify';
import { StateTooLargeError } from '../errors';
import { Logger } from '@openfn/logger';
import { parser } from 'stream-json';
import Assembler from 'stream-json/assembler.js';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';

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

    const source = new JsonStreamStringify(value, replacer, 0, true);

    const sizeGuard = new Transform({
      transform(chunk, _enc, cb) {
        size_bytes += Buffer.byteLength(chunk, 'utf8');
        if (size_bytes > limitBytes) {
          return cb(new StateTooLargeError(limit_mb));
        }

        cb(null, chunk);
      },
    });

    const jsonParser = parser.asStream();
    const asm = Assembler.connectTo(jsonParser, {
      reviver: (_key, value) => {
        if (
          value &&
          typeof value === 'object' &&
          typeof value.$ref === 'string'
        ) {
          return '[Circular]';
        }
        return value;
      },
    });

    try {
      await pipeline(source, sizeGuard, jsonParser);
    } catch (e) {
      if (e instanceof StateTooLargeError) {
        logger?.info(
          `state object exceeds limit ${limit_mb} (${(
            size_bytes /
            1024 /
            1024
          ).toFixed(2)}mb)`
        );
      }
      throw e;
    }

    if (size_bytes < 1024 * 1024) {
      logger?.debug(`State object serializes to less than 1mb`);
    } else {
      logger?.debug(
        `State object serializes to ${(size_bytes / 1024 / 1024).toFixed(2)}mb`
      );
    }

    return asm.current;
  }
};
