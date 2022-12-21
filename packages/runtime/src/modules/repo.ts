import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { defaultLogger, Logger } from '@openfn/logger';
import exec from '../util/exec';

const defaultPkg = {
  name: 'openfn-repo',
  description: 'A repository for modules used by the openfn runtime',
  private: true,
  author: 'Open Function Group <admin@openfn.org>',
  version: '1.0.0',
  dependencies: {},
};

export const defaultRepoPath = '/tmp/openfn/repo';

const ensureArray = (s: string | string[]): string[] => {
  if (Array.isArray(s)) {
    return s;
  }
  return [s] as string[];
};

type InstallList = Array<{ name: string; version: string }>;

const filterSpecifiers = async (
  specifiers: string[],
  repoPath: string,
  log: Logger
): Promise<InstallList> => {
  const result: InstallList = [];
  for (const s of specifiers) {
    // TODO we can optimise here by caching pkg
    let { name, version } = getNameAndVersion(s);
    if (!version) {
      version = await getLatestVersion(s);
    }

    const exists = await getModulePath(s, repoPath, log);
    if (exists) {
      log.info(`Skipping ${name}@${version} as already installed`);
    } else {
      log.info(`Will install ${name} version ${version}`);
      result.push({ name, version });
    }
  }
  return result;
};

/*
 * Install a module from a specifier (ie, name@version) to the provided repo path.
 * If a matching version is already installed, this does nothing.
 * TODO support multiple specifiers in one call
 */
export const install = async (
  specifiers: string | string[],
  repoPath: string = defaultRepoPath,
  log: Logger = defaultLogger,
  execFn = exec // for unit testing
) => {
  await ensureRepo(repoPath);
  const filtered = await filterSpecifiers(
    ensureArray(specifiers),
    repoPath,
    log
  );

  if (filtered.length) {
    const flags = ['--no-audit', '--no-fund', '--no-package-lock'];
    const aliases = filtered.map(({ name, version }) => {
      const alias = `npm:${name}@${version}`;
      const aliasedName = `${name}_${version}`;
      return `${aliasedName}@${alias}`;
    });
    // TODO it would be nice to report something about what's going on under the hood here
    await execFn(`npm install ${flags.join(' ')} ${aliases.join(' ')}`, {
      cwd: repoPath,
    });
    log.success(
      `Installed ${filtered
        .map(({ name, version }) => `${name}@${version}`)
        .join(', ')}`
    );
    return true;
  }
};

/*
 * Ensures a repo exists at that target path
 * If a package.json cannot be found, one will be created with default values
 * Returns the package json it finds
 */
export const ensureRepo = async (path: string, log: Logger = defaultLogger) => {
  await mkdir(path, { recursive: true });

  const pkgPath = `${path}/package.json`;
  try {
    const raw = await readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(raw);
    log.debug('Repo exists');
    return pkg;
  } catch (e) {
    log.debug(`Creating new repo at ${pkgPath}`);
    await writeFile(pkgPath, JSON.stringify(defaultPkg, null, 2));
    return { ...defaultPkg };
  }
};

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

  return { name, version } as { name: string; version?: string };
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

export const getLatestVersion = async (specifier: string) => {
  const { stdout } = await exec(`npm view ${specifier} version`);
  return stdout.trim(); // TODO this works for now but isn't very robust
};

export const loadRepoPkg = async (repoPath: string = defaultRepoPath) => {
  try {
    const pkgRaw = await readFile(`${repoPath}/package.json`, 'utf8');
    return JSON.parse(pkgRaw);
  } catch (e) {
    // TODO should we report this error anywhere? It's probably fine
    //console.error('ERROR PARSING REPO JSON');
    return null;
  }
};

// Note that the specifier shouldn't have an @
export const getLatestInstalledVersion = async (
  specifier: string,
  repoPath: string = defaultRepoPath,
  pkg?: object
) => {
  if (!pkg) {
    pkg = await loadRepoPkg(repoPath);
  }

  if (pkg) {
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
  }
  return null;
};

export const getModulePath = async (
  specifier: string,
  repoPath: string = defaultRepoPath,
  log = defaultLogger // TODO should this be a null logger?
) => {
  const { version } = getNameAndVersion(specifier);
  let alias;

  if (version) {
    // TODO: fuzzy semver match
    const a = getAliasedName(specifier);
    const pkg = await loadRepoPkg(repoPath);
    if (pkg && pkg.dependencies[a]) {
      alias = a;
    }
  } else {
    alias = await getLatestInstalledVersion(specifier, repoPath);
  }

  if (alias) {
    const p = path.resolve(`${repoPath}`, `node_modules/${alias}`);
    log.debug(`repo resolved ${specifier} path to ${p}`);
    return p;
  } else {
    log.debug(`module not found in repo: ${specifier}`);
  }
  return null;
};

// Unused stuff I want to hang onto for now..

// // This will alias the name of a specifier
// // If no version is specified, it will look up the latest installed one
// // If there is no version available then ???
// // Note that it's up to the auto-installer to decide whether to pre-install a
// // matching or latest verrsion
// export const ensureAliasedName = async (
//   specifier: string,
//   repoPath: string = defaultRepoPath
// ) => {
//   let { name, version } = getNameAndVersion(specifier);
//   if (!version) {
//     // TODO what if this fails?
//     return (await getLatestInstalledVersion(specifier, repoPath)) || 'UNKNOWN';
//   }
//   return `${name}_${version}`;
// };

// export const getModulePathFromAlias = (
//   alias: string,
//   repoPath: string = defaultRepoPath
// ) => {
//   // if there's no version specifier, we should take the latest available
//   //... but how do we know what that is?
//   return `${repoPath}/node_modules/${alias}`;
// };
