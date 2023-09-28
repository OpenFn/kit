import stringify from 'fast-safe-stringify';

export default (obj: any): string =>
  stringify(obj, (_key: string, value: any) => {
    if (value instanceof Uint8Array) {
      return Array.from(value);
    }
    return value;
  });
