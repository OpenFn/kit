import exec from '../util/exec';

// TODO what about x@^1 ?
export default async (specifier: string) => {
  let name;
  let version;

  const atIndex = specifier.lastIndexOf('@');
  if (atIndex > 0) {
    name = specifier.substring(0, atIndex);
    version = specifier.substring(atIndex + 1);
  } else {
    // if no version is provided, lookup the latest tag and we'll install that
    name = specifier;
    const { stdout } = await exec(`npm view ${specifier} version`);
    version = stdout.trim(); // TODO this works for now but isn't very robust
  }

  return { name, version } as { name: string; version: string };
};
