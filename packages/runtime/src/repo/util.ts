import { defaultRepoPath } from './install';
import { readFile } from 'node:fs/promises';
import exec from '../util/exec';
import path from 'node:path';

// TODO I thought it would be useful to put lots of small fiddly functions in here
// but actually this is most of the repo logic and it just makes it all hard to find!

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

// If there's no version in the specifer, we'll use @latest
// This ensures that a matching module can be found
// Someone needs to be responsible for ensureing that @latest is actually correct
// Which is an auto install issue
export const getAliasedName = (specifier: string, version?: string) => {
  let name;
  if (version === undefined) {
    const x = getNameAndVersion(specifier);
    name = x.name;
    version = x.version;
  } else {
    name = specifier;
  }

  if (version) {
    return `${name}_${version}`;
  }
  return name;
};

// This will alias the name of a specifier
// If no version is specified, it will look up the latest installed one
// If there is no version available then ???
// Note that it's up to the auto-installer to decide whether to pre-install a
// matching or latest verrsion
export const ensureAliasedName = async (
  specifier: string,
  repoPath: string = defaultRepoPath
) => {
  let { name, version } = getNameAndVersion(specifier);
  if (!version) {
    // TODO what if this fails?
    return (await getLatestInstalledVersion(specifier, repoPath)) || 'UNKNOWN';
  }
  return `${name}_${version}`;
};

export const getLatestVersion = async (specifier: string) => {
  const { stdout } = await exec(`npm view ${specifier} version`);
  return stdout.trim(); // TODO this works for now but isn't very robust
};

export const loadRepoPkg = async (repoPath: string = defaultRepoPath) => {
  try {
    const pkgRaw = await readFile(`${repoPath}/package.json`, 'utf8');
    return JSON.parse(pkgRaw);
  } catch (e) {
    console.error('ERROR PARSING REPO JSON');
    return null;
  }
};

// Note that the specifier shouldn't have an @
export const getLatestInstalledVersion = async (
  specifier: string,
  repoPath: string = defaultRepoPath,
  pkg?: JSON
) => {
  if (!pkg) {
    pkg = await loadRepoPkg(repoPath);
  }
  // @ts-ignore
  const { dependencies } = pkg;
  let latest: string | null = null;
  Object.keys(dependencies).forEach((d: string) => {
    if (d.startsWith(`${specifier}_`)) {
      const [_name, version] = d.split('_'); // todo what if there's genuinely an underscore in the name?
      if (!latest || version > latest) {
        latest = version;
      }
    }
  });
  if (latest) {
    return `${specifier}_${latest}`;
  }
  return null;
};

export const getModulePath = async (
  specifier: string,
  repoPath: string = defaultRepoPath
) => {
  const { version } = getNameAndVersion(specifier);
  let alias;

  if (version) {
    // TODO: fuzzy semver match
    const a = getAliasedName(specifier);
    const pkg = await loadRepoPkg(repoPath);
    if (pkg.dependencies[a]) {
      alias = a;
    }
  } else {
    alias = await getLatestInstalledVersion(specifier, repoPath);
  }

  if (alias) {
    return path.resolve(`${repoPath}`, `node_modules/${alias}`);
  }
  return null;
};

export const getModulePathFromAlias = (
  alias: string,
  repoPath: string = defaultRepoPath
) => {
  // if there's no version specifier, we should take the latest available
  //... but how do we know what that is?
  return `${repoPath}/node_modules/${alias}`;
};
