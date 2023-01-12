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
      log.info(`Looked up latest version of ${s}: found ${version}`);
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
  pkg?: object,
  log = defaultLogger
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
      log.debug(`Using latest installed version of ${latest}`);
      return `${specifier}_${latest}`;
    }
  }
  return null;
};

const getRepoAlias = async (
  specifier: string,
  repoPath: string = defaultRepoPath,
  log = defaultLogger
) => {
  const { version } = getNameAndVersion(specifier);

  if (version) {
    // TODO: fuzzy semver match
    const a = getAliasedName(specifier);
    const pkg = await loadRepoPkg(repoPath);
    if (pkg && pkg.dependencies[a]) {
      return a;
    }
  } else {
    return getLatestInstalledVersion(specifier, repoPath, undefined, log);
  }
};

export const getModulePath = async (
  specifier: string,
  repoPath: string = defaultRepoPath,
  log = defaultLogger
) => {
  const alias = await getRepoAlias(specifier, repoPath);

  if (alias) {
    const p = path.resolve(`${repoPath}`, `node_modules/${alias}`);
    log.debug(`repo resolved ${specifier} path to ${p}`);
    return p;
  } else {
    log.debug(`module not found in repo: ${specifier}`);
  }
  return null;
};

// ESM doesn't support importing directories, and from node 19 this is enforced
// For a given specifier, this will return a path to the main index.js file
// I don't think this will work for nested imports though
export const getModuleEntryPoint = async (
  specifier: string,
  modulePath?: string,
  repoPath: string = defaultRepoPath,
  log = defaultLogger
): Promise<{ path: string; version: string } | null> => {
  const moduleRoot = modulePath || (await getModulePath(specifier, repoPath));

  if (moduleRoot) {
    const pkgRaw = await readFile(`${moduleRoot}/package.json`, 'utf8');
    const pkg = JSON.parse(pkgRaw);
    let main = 'index.js';

    // TODO Turns out that importing the ESM format actually blows up
    // (at least when we try to import lodash)
    // if (pkg.exports) {
    //   if (typeof pkg.exports === 'string') {
    //     main = pkg.exports;
    //   } else {
    //     const defaultExport = pkg.exports['.']; // TODO what if this doesn't exist...
    //     if (typeof defaultExport == 'string') {
    //       main = defaultExport;
    //     } else {
    //       main = defaultExport.import;
    //     }
    //   }
    // } else
    // Safer for now to just use the CJS import
    if (pkg.main) {
      main = pkg.main;
    }
    const p = path.resolve(moduleRoot, main);
    log.debug(`repo resolved ${specifier} entrypoint to ${p}`);
    return { path: p, version: pkg.version };
  } else {
    log.debug(`module not found in repo: ${specifier}`);
  }
  return null;
};
