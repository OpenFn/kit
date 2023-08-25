export const uuidRegex = new RegExp(
  '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  'i'
);

export const hyphenate = (str: any) => {
  return str.replace(/\s+/g, '-');
};

// convert array of { id, ...stuff } into object { id: stuff }
// also allow a callback on stuff for further conversion
export const reduceByKey = (
  key: string,
  arr: [{ name: string }], // TODO how do we say [key]: name
  callback = (x: any) => x
) => {
  return arr.reduce((acc: any, obj: any) => {
    const k = hyphenate(obj[key]);
    acc[k] = callback({ ...obj });
    return acc;
  }, {});
};

export const assignIfTruthy = (obj: any, incoming: any) => {
  Object.entries(incoming).forEach(([key, value]) => {
    if (!isNaN(value) || value) {
      obj[key] = value;
    }
  });
  return obj;
};

// Takes two objects and matches up their keys, returning an array of tuples
// containing the key, the value from the left object, and the value from the
// right object. If a key is missing from one object, the corresponding value
// will be null.
export function splitZip<
  L extends { [k: string]: any },
  R extends { [k: string]: any }
>(l: L, r: R): [keyof L | keyof R, L[keyof L] | null, R[keyof R] | null][] {
  return concatKeys(l, r).map((key) => {
    return [key, l[key], r[key]];
  });
}

export function mapReduce<T, U>(
  obj: { [key: string]: T },
  fn: (x: T) => U
): { [key: string]: U } {
  return Object.entries(obj).reduce<{ [key: string]: U }>(
    (acc, [key, value]) => {
      return { ...acc, [key]: fn(value) };
    },
    {}
  );
}

// Get all keys from all objects and ensure they are unique
export function concatKeys(...objs: Object[]): string[] {
  return objs
    .reduce<string[]>((acc, obj) => {
      return acc.concat(Object.keys(obj));
    }, [])
    .reduce<string[]>((acc, key) => {
      if (!acc.includes(key)) {
        acc.push(key);
      }
      return acc;
    }, []);
}

export function omitKeys<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const newObj = { ...obj };
  for (const key of keys) {
    delete newObj[key];
  }
  return newObj;
}

export function pickKeys<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const newObj = {} as typeof obj;
  for (const key of keys) {
    newObj[key] = obj[key];
  }
  return newObj;
}

export function isEmpty(obj: Object) {
  return Object.keys(obj).length === 0;
}
