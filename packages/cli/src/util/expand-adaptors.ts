export default (names: string[]) =>
  names?.map((name) => {
    if (typeof name === 'string') {
      if (name.startsWith('@openfn/language-')) {
        return name;
      }
      return `@openfn/language-${name}`;
    }
    return name;
  });
