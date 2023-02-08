export default (names: string[]) =>
  names?.map((name) => {
    if (name.startsWith('@openfn/language-')) {
      return name;
    }
    return `@openfn/language-${name}`;
  });
