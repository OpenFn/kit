import type { State } from '@openfn/lexicon';
import stringify from 'fast-safe-stringify';

import { JsonStreamStringify } from 'json-stream-stringify';

// TODO I'm in the market for the best solution here - immer? deep-clone?
// What should we do if functions are in the state?
export default (state: State) => JSON.parse(stringify(state));

const replacer = (_key: string, value: any) => {
  // Ignore non serializable keys
  if (
    value === undefined ||
    typeof value === 'function' ||
    value.constructor?.name === 'Promise'
  ) {
    return undefined;
  }

  // Return a nicer representation of circular values
  if (value.$ref && Object.keys(value).length === 1) {
    return '[Circular]';
  }
  return value;
};

export const asyncClone = async (
  state: State,
  limit_mb = 1000
): Promise<State> => {
  const limit_bytes = limit_mb * 1024 * 1024;
  let size_bytes = 0;
  let jsonString = '';

  // one big worry with this approach is that jsonstreamstringify
  // does not behave the same as stringify
  // ie, how it handles functions
  const stream = new JsonStreamStringify(state, replacer, undefined, true);

  try {
    for await (const chunk of stream) {
      // Each chunk is a string token from the JSON output
      const chunkSize = Buffer.byteLength(chunk, 'utf8');
      size_bytes += chunkSize;

      if (size_bytes > limit_bytes) {
        stream.destroy();
        throw new Error(
          `State size exceeds limit: ${(size_bytes / 1024 / 1024).toFixed(
            2
          )}MB > ${limit_mb}MB`
        );
      }

      jsonString += chunk;
    }
    // Re-parse the stringified JSON back into an object
    return JSON.parse(jsonString);
  } catch (error) {
    stream.destroy();
    throw error;
  }
};
