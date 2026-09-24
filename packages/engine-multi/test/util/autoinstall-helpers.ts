import path from 'node:path';
import os from 'node:os';
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import esmock from 'esmock';
import * as runtime from '@openfn/runtime';
import { getAliasedName, getNameAndVersion } from '@openfn/runtime';

// Helpers for autoinstall tests. We exercise the real `isInstalled` by
// seeding a tmp repoDir on disk; the engine's autoinstall reads the repo's
// package.json and stats node_modules/<alias>/package.json.

export const createTmpRepo = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'engine-autoinstall-'));
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'repo', dependencies: {} })
  );
  return dir;
};

export const removeTmpRepo = (dir: string) =>
  rm(dir, { recursive: true, force: true });

// Mark a specifier as installed by writing the dep into package.json and
// seeding node_modules/<alias>/package.json. The alias matches @openfn/runtime's
// getAliasedName output.
export const markInstalled = async (repoDir: string, specifier: string) => {
  const alias = getAliasedName(specifier);
  const pkgPath = path.join(repoDir, 'package.json');
  const raw = await readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);
  pkg.dependencies = pkg.dependencies || {};
  const { version } = getNameAndVersion(specifier);
  pkg.dependencies[alias] = version || '*';
  await writeFile(pkgPath, JSON.stringify(pkg));
  const modDir = path.join(repoDir, 'node_modules', alias);
  await mkdir(modDir, { recursive: true });
  await writeFile(path.join(modDir, 'package.json'), '{}');
};

export type InstallImpl = (
  specifiers: string[],
  repoDir: string,
  logger: any
) => Promise<void>;

export type AutoinstallModule = typeof import('../../src/api/autoinstall');

// Load autoinstall with @openfn/runtime's install swapped out so tests can
// control install behaviour without touching npm. Each call returns a fresh
// module so module-level queue/busy state is isolated between tests.
export const loadAutoinstall = async (
  installImpl: InstallImpl
): Promise<AutoinstallModule> =>
  esmock('../../src/api/autoinstall.ts', {
    '@openfn/runtime': {
      ...runtime,
      install: installImpl,
    },
  });

// Returns a stubbed install + counters. Pass `seedOnInstall: true` to write
// node_modules/<alias>/package.json + repo dep entry so the real `isInstalled`
// returns true after the stub runs.
export const createInstallStub = (opts: {
  seedOnInstall?: boolean;
  delayMs?: number;
  onCall?: (specifier: string) => void;
  throws?: Error | (() => Error);
} = {}) => {
  const calls: string[] = [];
  const fn: InstallImpl = async (specifiers, repoDir) => {
    for (const s of specifiers) {
      calls.push(s);
      opts.onCall?.(s);
      if (opts.delayMs) {
        await new Promise((r) => setTimeout(r, opts.delayMs));
      }
      if (opts.throws) {
        throw typeof opts.throws === 'function' ? opts.throws() : opts.throws;
      }
      if (opts.seedOnInstall) {
        await markInstalled(repoDir, s);
      }
    }
  };
  return { fn, calls };
};

