export const REDACTED_STATE = {
  data: '[REDACTED_STATE]',
  _$REDACTED$_: true,
};

export const REDACTED_LOG = {
  message: ['[REDACTED: MESSAGE TOO LARGE]'],
  _$REDACTED$_: true,
};

const verify = (value: any, limit_mb: number = 10) => {
  if (value && limit_mb) {
    let size_mb = 0;
    try {
      const str = JSON.stringify(value);
      // should this be utf16?
      // It's the JSON size we care about though right?
      const size_bytes = Buffer.byteLength(str, 'utf8');
      size_mb = size_bytes / 1024 / 1024;
    } catch (e) {
      // do nothing
    }

    if (size_mb > limit_mb) {
      throw {};
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
  }
  try {
    verify(payload.log, limit_mb);
  } catch (e) {
    Object.assign(newPayload.log, REDACTED_LOG);
  }
  return newPayload;
};
