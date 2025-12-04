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

export const exceedsSizeTraverse = async (value: any, limit_mb: number) => {};

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
