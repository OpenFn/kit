// This is copied from runtime/modules/repo, where it's well tested
// I can't import it to the browser (easily) because of other
// dependencies in the runtime
export const getNameAndVersion = (specifier: string) => {
  let name;
  let version;

  const atIndex = specifier.lastIndexOf('@');
  if (atIndex > 0) {
    name = specifier.substring(0, atIndex);
    version = specifier.substring(atIndex + 1);
  } else {
    name = specifier;
  }

  return { name, version } as { name: string; version: string };
};
