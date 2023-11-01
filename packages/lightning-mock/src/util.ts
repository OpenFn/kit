import fss from 'fast-safe-stringify';

export const ATTEMPT_PREFIX = 'attempt:';

export const extractAttemptId = (topic: string) =>
  topic.substr(ATTEMPT_PREFIX.length);

// This is copied out of ws-worker and untested here
export const stringify = (obj: any): string =>
  fss(obj, (_key: string, value: any) => {
    if (value instanceof Uint8Array) {
      return Array.from(value);
    }
    return value;
  });
