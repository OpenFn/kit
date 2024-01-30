import fss from 'fast-safe-stringify';

export const RUN_PREFIX = 'run:';

export const extractRunId = (topic: string) =>
  topic.substr(RUN_PREFIX.length);

// This is copied out of ws-worker and untested here
export const stringify = (obj: any): string =>
  fss(obj, (_key: string, value: any) => {
    if (value instanceof Uint8Array) {
      return Array.from(value);
    }
    return value;
  });
