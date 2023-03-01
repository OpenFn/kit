export default (names: string[]) =>
  names?.map((name) => {
    if (typeof name === 'string') {
      // don't expand adaptors which look like a path (or @openfn/language-)
      if (name.match('/') || name.endsWith('.js')) {
        return name;
      }
      return `@openfn/language-${name}`;
    }
    return name;
  });
