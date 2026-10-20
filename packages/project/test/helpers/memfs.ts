import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncBuiltinESMExports } from 'node:module';
import { memfs, type NestedDirectoryJSON } from 'memfs';

/*
 * Swaps node:fs for memfs while mocked. Every fs function is replaced once,
 * when this module loads, with one that picks memfs or the real disk on each
 * call. Libraries like glob and rimraf keep references to fs functions from
 * load time, so import this before the code under test.
 */

type FsObject = Record<string, any>;

// Tests run from the package folder, two below the repo root
const repoModules = path.resolve('../../node_modules') + path.sep;

let mem: FsObject | undefined;
const realFds = new Set<number>();

// The repo's own node_modules stay on the real disk, so that Node's module
// loader (which reads through node:fs) can still load dependencies lazily
const useReal = (target: unknown) => {
  if (!mem) return true;
  if (typeof target === 'number') return realFds.has(target);
  if (typeof target === 'string') {
    return path.resolve(target).startsWith(repoModules);
  }
  if (target instanceof URL) {
    return path.resolve(fileURLToPath(target)).startsWith(repoModules);
  }
  return false;
};

const dispatch = (
  target: FsObject,
  key: string,
  getMem: () => FsObject | undefined
) => {
  const real = target[key];
  const fn = (...args: any[]) => {
    if (!useReal(args[0])) return getMem()![key](...args);
    if (key === 'openSync') {
      const fd = real(...args);
      realFds.add(fd);
      return fd;
    }
    if (key === 'open' && typeof args.at(-1) === 'function') {
      const cb = args.pop();
      return real(...args, (err: Error | null, fd: number) => {
        if (!err) realFds.add(fd);
        cb(err, fd);
      });
    }
    if (key === 'close' || key === 'closeSync') realFds.delete(args[0]);
    return real(...args);
  };
  if (real.native) {
    fn.native = (...args: any[]) =>
      useReal(args[0]) ? real.native(...args) : getMem()![key](...args);
  }
  target[key] = fn;
};

// Classes like fs.ReadStream and getter-only exports like fs.Utf8Stream
// are left alone
const functionKeys = (obj: FsObject) =>
  Object.keys(obj).filter(
    (key) =>
      /^[a-z]/.test(key) &&
      typeof obj[key] === 'function' &&
      Object.getOwnPropertyDescriptor(obj, key)?.writable
  );

const realFs = fs as unknown as FsObject;
const realPromises = fs.promises as unknown as FsObject;
for (const key of functionKeys(realFs)) dispatch(realFs, key, () => mem);
for (const key of functionKeys(realPromises)) {
  dispatch(realPromises, key, () => mem?.promises);
}
syncBuiltinESMExports();

// Mocks the filesystem with only `tree`, plus the cwd and tmpdir. Relative
// paths in `tree` resolve against the cwd.
export const mockFs = (tree: NestedDirectoryJSON = {}) => {
  restoreFs();
  const { fs: next } = memfs(tree, process.cwd());
  next.mkdirSync(process.cwd(), { recursive: true });
  next.mkdirSync(os.tmpdir(), { recursive: true });
  mem = next as unknown as FsObject;
};

export const restoreFs = () => {
  mem = undefined;
};

const readReal = (target: string): NestedDirectoryJSON | Buffer => {
  if (!fs.statSync(target).isDirectory()) {
    return fs.readFileSync(target);
  }
  const dir: NestedDirectoryJSON = {};
  for (const name of fs.readdirSync(target)) {
    dir[name] = readReal(path.join(target, name));
  }
  return dir;
};

// Reads a real file or directory into a tree for mockFs, even while mocked
export const loadPath = (target: string): NestedDirectoryJSON | Buffer => {
  const current = mem;
  mem = undefined;
  try {
    return readReal(target);
  } finally {
    mem = current;
  }
};
