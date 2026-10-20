import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { syncBuiltinESMExports } from 'node:module';
import { memfs, type NestedDirectoryJSON } from 'memfs';

/*
 * Swaps node:fs for memfs while mocked. Every fs function is replaced once,
 * when this module loads, with one that picks memfs or the real disk on each
 * call. Libraries like glob and rimraf keep references to fs functions from
 * load time, so the root ava config preloads this before any test file.
 */

type FsObject = Record<string, any>;

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

let mem: FsObject | undefined;
const memFds = new Set<number>();

const toPath = (target: unknown) => {
  if (typeof target === 'string') return target;
  if (Buffer.isBuffer(target)) return target.toString();
  if (target instanceof URL) return fileURLToPath(target);
};

// node_modules folders in the repo stay on the real disk, so that Node's
// module loader (which reads through node:fs) can still load dependencies
// lazily. Mocked trees can still hold their own node_modules elsewhere.
const useReal = (target: unknown) => {
  if (!mem) return true;
  if (typeof target === 'number') return !memFds.has(target);
  const p = toPath(target);
  if (p === undefined) return false;
  const abs = path.resolve(p);
  return (
    abs.startsWith(repoRoot) &&
    abs.slice(repoRoot.length).split(path.sep).includes('node_modules')
  );
};

const exdev = (syscall: string, from: unknown, to: unknown) =>
  Object.assign(
    new Error(
      `EXDEV: cross-device link not permitted, ${syscall} '${from}' -> '${to}'`
    ),
    { code: 'EXDEV', syscall }
  );

// Two-path calls go to the destination's side. A copyFile across sides
// copies the bytes; anything else across sides fails like a cross-device move.
const twoPath = new Set(['copyFile', 'cp', 'rename', 'link', 'symlink']);

const crossSides = (name: string, [src, dest, mode]: any[]) => {
  if (name !== 'copyFile') throw exdev(name, src, dest);
  const excl = typeof mode === 'number' && mode & fs.constants.COPYFILE_EXCL;
  fs.writeFileSync(dest, fs.readFileSync(src), { flag: excl ? 'wx' : 'w' });
};

const dispatch = (
  target: FsObject,
  key: string,
  getMem: () => FsObject | undefined,
  isPromise: boolean
) => {
  const real = target[key];
  const name = key.replace(/Sync$/, '');
  const sync = key.endsWith('Sync');

  const fn: any = (...args: any[]) => {
    if (!mem) return real(...args);
    if (twoPath.has(name)) {
      const destReal = useReal(args[1]);
      if (name !== 'symlink' && useReal(args[0]) !== destReal) {
        if (sync) return crossSides(name, args);
        const done = new Promise<void>((resolve) =>
          resolve(crossSides(name, args))
        );
        if (isPromise) return done;
        const cb = args.at(-1);
        done.then(() => cb(null), cb);
        return;
      }
      return destReal ? real(...args) : getMem()![key](...args);
    }
    if (useReal(args[0])) return real(...args);

    const memFn = getMem()![key];
    if (isPromise && key === 'open') {
      return memFn(...args).then((handle: any) => {
        memFds.add(handle.fd);
        return handle;
      });
    }
    if (key === 'open' && typeof args.at(-1) === 'function') {
      const cb = args.pop();
      return memFn(...args, (err: Error | null, fd: number) => {
        if (!err) memFds.add(fd);
        cb(err, fd);
      });
    }
    const result = memFn(...args);
    if (key === 'openSync') memFds.add(result);
    if (name === 'close') memFds.delete(args[0]);
    return result;
  };

  // Keeps util.promisify working: customPromisifyArgs on read and write,
  // and promisify.custom on exists (whose callback takes no error)
  for (const sym of Object.getOwnPropertySymbols(real)) fn[sym] = real[sym];
  if (key === 'exists') {
    fn[promisify.custom] = (p: unknown) =>
      new Promise((resolve) => fn(p, resolve));
  }
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
for (const key of functionKeys(realFs)) {
  dispatch(realFs, key, () => mem, false);
}
for (const key of functionKeys(realPromises)) {
  dispatch(realPromises, key, () => mem?.promises, true);
}
syncBuiltinESMExports();

// Mocks the filesystem with only `tree`, plus the cwd and tmpdir. Relative
// paths in `tree` resolve against the cwd.
export const mockFs = (tree: NestedDirectoryJSON = {}) => {
  if (mem) {
    throw new Error('mockFs called while already mocked: call restoreFs first');
  }
  const { fs: next } = memfs(tree, process.cwd());
  next.mkdirSync(process.cwd(), { recursive: true });
  next.mkdirSync(os.tmpdir(), { recursive: true });
  memFds.clear();
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
