import { Buffer } from 'node:buffer';
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
  // skip all primitives
  if (
    !value ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'function'
  ) {
    // Treat as size 0
    return 0;
  }

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

export default async (payload: any, limit_mb: number = 10) => {
  if (!limit_mb || isNaN(limit_mb)) {
    return payload;
  }

  const newPayload = { ...payload };

  for (const key of KEYS_TO_VERIFY) {
    if (key in payload) {
      try {
        await verify(payload[key], limit_mb, 'stream');
      } catch (e: any) {
        if (e.name === 'PAYLOAD_TOO_LARGE') {
          Object.assign(
            newPayload[key],
            replacements[key] ?? replacements.default
          );
          newPayload.redacted = true;
        } else {
          console.log(e)
        }
      }
    }
  }

  return newPayload;
};

// export default async (payload: any, limit_mb: number = 10) => {
//   return new Promise(async (resolve) => {
//     if (!limit_mb || isNaN(limit_mb)) {
//       resolve( payload);
//     }

//     const newPayload = { ...payload };

//     for (const key of KEYS_TO_VERIFY) {
//       if (key in payload) {
//         try {
//           await verify(payload[key], limit_mb, 'stream');
//         } catch (e) {
//           if (e.name === 'PAYLOAD_TOO_LARGE') {
//             Object.assign(
//               newPayload[key],
//               replacements[key] ?? replacements.default
//             );
//             newPayload.redacted = true;
//           }
//         }
//       }
//     }

//     setTimeout(() => {
//       resolve(newPayload)

//     }, 1000)

//   })
// };
