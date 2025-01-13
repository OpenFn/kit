export default <T extends object, U extends keyof T>(
  obj: T,
  ...keys: U[]
): Pick<T, U> =>
  keys.reduce((acc, key) => {
    if (key in obj) {
      // @ts-ignore
      acc[key] = obj[key];
    }
    return acc;
  }, {} as T);
