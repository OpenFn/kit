// This specifies which keys of an event payload to potentially redact
// if they are too big
const KEYS_TO_VERIFY = ['state', 'final_state', 'message'];

const replacements: Record<string, any> = {
  message: ['[REDACTED: log length exceeds payload limit]'],
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

const ensure = (payload: any, limit_mb: number = 10) => {
  const newPayload = { ...payload };

  for (const key of KEYS_TO_VERIFY) {
    try {
      verify(payload[key], limit_mb);
    } catch (e) {
      Object.assign(newPayload[key], replacements[key] ?? replacements.default);
      newPayload.redacted = true;
    }
  }
  // special handling for batched log events
  if (payload.logs) {
    return {
      ...payload,
      logs: payload.logs.map((l: any) => ensure(l, limit_mb)),
    };
  }

  return newPayload;
};

export default ensure;
