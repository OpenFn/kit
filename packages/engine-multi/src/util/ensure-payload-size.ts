import { JsonStreamStringify } from 'json-stream-stringify';
import type { ExternalEvent } from '../events';

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
): Promise<number | undefined> => {
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
      // @ts-ignore carry the size we already computed out to the caller
      e.sizeBytes = sizeBytes;
      throw e;
    }

    return sizeBytes;
  }

  return undefined;
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
  let size_bytes = 0;

  const stream = new JsonStreamStringify(value);

  for await (const chunk of stream) {
    // Each chunk is a string token from the JSON output
    size_bytes += Buffer.byteLength(chunk, 'utf8');

    if (limit !== undefined && size_bytes > limit) {
      break;
    }
  }
  stream.destroy();

  return size_bytes;
};

export default async (
  payload: ExternalEvent,
  limit_mb: number = 10
): Promise<ExternalEvent> => {
  const newPayload: any = { ...payload };
  const rawPayload = payload as any;

  for (const key of KEYS_TO_VERIFY) {
    try {
      const sizeBytes = await verify(rawPayload[key], limit_mb);
      if (key === 'state' && sizeBytes !== undefined) {
        newPayload.payloadSize_b = sizeBytes;
      }
    } catch (e: any) {
      const replacement = replacements[key];
      if (replacement) {
        // A key-specific replacement (eg 'log') has a known, fixed shape -
        // merge so other fields on it (time, level, ...) survive
        Object.assign(newPayload[key], replacement);
      } else {
        newPayload[key] = replacements.default;
      }
      newPayload.redacted = true;
      if (key === 'state') {
        newPayload.payloadSize_b = e.sizeBytes;
      }
    }
  }

  return newPayload;
};
