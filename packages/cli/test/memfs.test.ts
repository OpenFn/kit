import test from 'ava';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { mockFs, restoreFs } from './helpers/memfs';

const require = createRequire(import.meta.url);

// Resolved without require, so that require's own caches stay cold
const realModule = fs.realpathSync('node_modules/treeify/treeify.js');

test.afterEach(restoreFs);

test.serial('require loads a package dependency while mocked', (t) => {
  mockFs();
  const treeify = require('treeify');
  t.is(typeof treeify.asTree, 'function');
});

test.serial('copyFileSync from node_modules writes into memfs', (t) => {
  const dest = path.join(os.tmpdir(), `memfs-copy-${process.pid}.js`);
  mockFs();
  try {
    fs.copyFileSync(realModule, dest);
    t.true(fs.existsSync(dest));
    restoreFs();
    t.false(fs.existsSync(dest));
  } finally {
    restoreFs();
    fs.rmSync(dest, { force: true });
  }
});

test.serial('fstatSync works on stdout while mocked', (t) => {
  mockFs();
  t.notThrows(() => fs.fstatSync(1));
});

test.serial('fds from fs.promises.open can be read and closed', async (t) => {
  mockFs({ '/a.txt': 'hello' });
  for (const [file, expected] of [
    ['/a.txt', 'hello'],
    [realModule, fs.readFileSync(realModule, 'utf8').slice(0, 5)],
  ]) {
    const handle = await fs.promises.open(file);
    const buffer = Buffer.alloc(5);
    fs.readSync(handle.fd, buffer, 0, 5, 0);
    t.is(buffer.toString(), expected);
    await handle.close();
  }
});

test.serial('promisified exists resolves true for a mocked path', async (t) => {
  mockFs({ '/a.txt': 'hello' });
  t.true(await promisify(fs.exists)('/a.txt'));
});

test.serial('a Buffer path into node_modules reads the real disk', (t) => {
  mockFs();
  const content = fs.readFileSync(Buffer.from(realModule), 'utf8');
  t.true(content.length > 0);
});

test.serial('mockFs throws while a mock is already active', (t) => {
  mockFs();
  t.throws(() => mockFs());
});
