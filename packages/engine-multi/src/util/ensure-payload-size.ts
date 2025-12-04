// @ts-ignore - no type definitions available
import { JsonStreamStringify } from 'json-stream-stringify';

// This specifies which keys of an event payload to potentially redact
// if they are too big
const KEYS_TO_VERIFY = ['state', 'final_state', 'log'];

const replacements: Record<string, any> = {
  log: {
    message: ['[REDACTED: Message length exceeds payload limit]'],
  },
  default: {
    data: '[REDACTED]',
  },
};

export const verify = async (
  value: any,
  limit_mb: number = 10,
  algo: 'stringify' | 'traverse' | 'stream' = 'stringify'
) => {
  if (value && !isNaN(limit_mb)) {
    const limitBytes = limit_mb * 1024 * 1024;

    let sizeBytes: number;
    if (algo === 'traverse') {
      sizeBytes = await calculateSizeTraverse(value, limitBytes);
    } else if (algo === 'stream') {
      sizeBytes = await calculateSizeStream(value, limitBytes);
    } else {
      sizeBytes = calculateSizeStringify(value);
    }

    if (sizeBytes > limitBytes) {
      const e = new Error();
      // @ts-ignore
      e.name = 'PAYLOAD_TOO_LARGE';
      e.message = `The payload exceeded the size limit of ${limit_mb}mb`;
      throw e;
    }
  }
};

export const calculateSizeStringify = (value: any): number => {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  const size_bytes = Buffer.byteLength(str, 'utf8');
  return size_bytes;
};

export const calculateSizeTraverse = async (
  value: any,
  limit?: number
): Promise<number> => {
  let currentSize = 0;
  const visited = new WeakSet();
  let operations = 0;
  const YIELD_INTERVAL = 10000; // Yield every N operations to prevent blocking

  const stack = [value];

  while (stack.length > 0) {
    operations++;
    if (operations % YIELD_INTERVAL === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    // Early exit if we've already exceeded the limit
    if (limit !== undefined && currentSize > limit) {
      return currentSize;
    }

    const val = stack.pop();

    if (typeof val === 'undefined') {
      // these are excluded from json stringify
      // so we must ignore them
      continue;
    }

    if (val === null) {
      currentSize += 4;
      continue;
    }

    const type = typeof val;

    if (type === 'string') {
      currentSize += val.length + 2;
      continue;
    }

    if (type === 'number') {
      currentSize += val.toString().length;
      continue;
    }

    if (type === 'boolean') {
      currentSize += val ? 4 : 5; // "true" or "false"
      continue;
    }

    // Prevent circular reference infinite loops
    if (visited.has(val)) continue;
    visited.add(val);

    currentSize += 2; // For {} or []

    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        stack.push(val[i]);
        if (i < val.length - 1) currentSize += 1; // comma separator
      }
    } else if (type === 'object') {
      const keys = Object.keys(val);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (val[key] === undefined) {
          // excluded from stringify
          continue;
        }
        currentSize += key.length + 3; // "key":
        stack.push(val[key]);
        if (i < keys.length - 1) currentSize += 1; // comma separator
      }
    }
  }

  return currentSize;
};

export const calculateSizeStream = async (
  value: any,
  limit?: number
): Promise<number> => {
  let size = 0;

  try {
    // @ts-ignore - streamingStringify returns an async iterable
    const stream = new JsonStreamStringify(value);

    // Consume the stream chunk by chunk
    for await (const chunk of stream) {
      // Each chunk is a string token from the JSON output
      size += Buffer.byteLength(chunk, 'utf8');
      // size +=
      // Early exit if we've exceeded the limit
      if (limit !== undefined && size > limit) {
        // The stream should stop naturally once we stop consuming
        return size;
      }
    }
  } catch (e) {
    // If streaming fails, fall back to regular stringify
    return calculateSizeStringify(value);
  }

  return size;
};

export default async (payload: any, limit_mb: number = 10) => {
  const newPayload = { ...payload };

  for (const key of KEYS_TO_VERIFY) {
    try {
      await verify(payload[key], limit_mb);
    } catch (e) {
      Object.assign(newPayload[key], replacements[key] ?? replacements.default);
      newPayload.redacted = true;
    }
  }

  return newPayload;
};
