export default (names: string[]) =>
  names?.map((name) => {
    if (typeof name === 'string') {
      const [left] = name.split('=');
      // don't expand adaptors which look like a path (or @openfn/language-)
      if (left.match('/') || left.endsWith('.js')) {
        return name;
      }
      return `@openfn/language-${name}`;
    }
    return name;
  });
