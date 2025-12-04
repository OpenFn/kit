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
  algo: 'stringify' | 'traverse' = 'stringify'
) => {
  if (value && !isNaN(limit_mb)) {
    const isTooBig =
      algo === 'traverse'
        ? await exceedsSizeTraverse(value, limit_mb)
        : exceedsSizeStringify(value, limit_mb);

    if (isTooBig) {
      const e = new Error();
      // @ts-ignore
      e.name = 'PAYLOAD_TOO_LARGE';
      e.message = `The payload exceeded the size limit of ${limit_mb}mb`;
      throw e;
    }
  }
};

export const exceedsSizeStringify = (value: any, limit_mb: number) => {
  let size_mb = 0;

  const str = typeof value === 'string' ? value : JSON.stringify(value);
  const size_bytes = Buffer.byteLength(str, 'utf8');
  size_mb = size_bytes / 1024 / 1024;

  return size_mb > limit_mb;
};

export const exceedsSizeTraverse = async (value: any, limit_mb: number) => {
  const maxBytes = limit_mb * 1024 * 1024;
  let currentSize = 0;
  const visited = new WeakSet();
  let operations = 0;
  const YIELD_INTERVAL = 10000; // Yield every N operations to prevent blocking

  async function traverse(val: any): Promise<boolean> {
    operations++;
    if (operations % YIELD_INTERVAL === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    // Early exit if we've already exceeded the limit
    if (currentSize > maxBytes) return true;

    if (val === null || val === undefined) {
      currentSize += 4; // "null" or "undefined"
      return false;
    }

    const type = typeof val;

    if (type === 'string') {
      currentSize += Buffer.byteLength(val, 'utf8');
      return currentSize > maxBytes;
    }

    if (type === 'number') {
      currentSize += val.toString().length;
      return currentSize > maxBytes;
    }

    if (type === 'boolean') {
      currentSize += val ? 4 : 5; // "true" or "false"
      return currentSize > maxBytes;
    }

    // Prevent circular reference infinite loops
    if (visited.has(val)) {
      return false;
    }
    visited.add(val);

    currentSize += 2; // For {} or []

    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        if (await traverse(val[i])) return true;
        if (i < val.length - 1) currentSize += 1; // comma separator
      }
    } else if (type === 'object') {
      const keys = Object.keys(val);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        currentSize += Buffer.byteLength(key, 'utf8') + 3; // "key":
        if (await traverse(val[key])) return true;
        if (i < keys.length - 1) currentSize += 1; // comma separator
      }
    }

    return false;
  }

  return traverse(value);
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
