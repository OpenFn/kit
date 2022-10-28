import exec from '../util/exec';

// TODO I think this is deprecated already
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
    // TODO I am not convinced this is correct
    // shouldn't someone else - maybe the loader/installer - lookup the latest version if none is provided?
    name = specifier;
    const { stdout } = await exec(`npm view ${specifier} version`);
    version = stdout.trim(); // TODO this works for now but isn't very robust
  }

  return { name, version } as { name: string; version: string };
};
