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

export const verify = (value: any, limit_mb: number = 10) => {
  if (value && !isNaN(limit_mb)) {
    let size_mb = 0;
    try {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      const size_bytes = Buffer.byteLength(str, 'utf8');
      size_mb = size_bytes / 1024 / 1024;
    } catch (e) {
      // do nothing
    }

    if (size_mb > limit_mb) {
      const e = new Error();
      // @ts-ignore
      e.name = 'PAYLOAD_TOO_LARGE';
      e.message = `The payload exceeded the size limit of ${limit_mb}mb`;
      throw e;
    }
  }
};

export default (payload: any, limit_mb: number = 10) => {
  const newPayload = { ...payload };

  for (const key of KEYS_TO_VERIFY) {
    try {
      verify(payload[key], limit_mb);
    } catch (e) {
      // For log objects, preserve the original structure and only replace specific fields
      if (key === 'log' && newPayload[key]) {
        newPayload[key] = {
          ...newPayload[key],
          ...(replacements[key] ?? replacements.default),
        };
      } else {
        Object.assign(newPayload[key], replacements[key] ?? replacements.default);
      }
      newPayload.redacted = true;
    }
  }

  return newPayload;
};
