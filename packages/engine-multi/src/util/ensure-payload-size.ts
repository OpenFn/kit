export const REDACTED_STATE = {
  data: '[REDACTED_STATE]',
  _$REDACTED$_: true,
};

export const REDACTED_LOG = {
  message: ['[REDACTED: Message length exceeds payload limit]'],
  _$REDACTED$_: true,
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

  // The payload could be any of the runtime events
  // The bits we might want to redact are state and message
  try {
    verify(payload.state, limit_mb);
  } catch (e) {
    newPayload.state = REDACTED_STATE;
    newPayload.redacted = true;
  }
  try {
    verify(payload.log, limit_mb);
  } catch (e) {
    Object.assign(newPayload.log, REDACTED_LOG);
    newPayload.redacted = true;
  }
  return newPayload;
};
