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
  algo: 'stringify' | 'stream' = 'stringify'
) => {
  if (value && !isNaN(limit_mb)) {
    const limitBytes = limit_mb * 1024 * 1024;

    let sizeBytes: number;
    if (algo === 'stream') {
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
