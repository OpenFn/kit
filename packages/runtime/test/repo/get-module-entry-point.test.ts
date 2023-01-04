import test from 'ava';
import mock from 'mock-fs';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';
import { getModuleEntryPoint } from '../../src/modules/repo';

const logger = createMockLogger();

test.afterEach(() => {
  mock.restore();
  logger._reset();
});

const repoPath = path.resolve('test/__repo__');

const mockRepo = (pkg: object) => {
  mock({
    [`${repoPath}/package.json`]: JSON.stringify({
      name: 'test',
      private: true,
      dependencies: {
        'x_1.0.0': 'npm:x@1.0.0',
      },
    }),
    [`${repoPath}/node_modules/x_1.0.0/package.json`]: JSON.stringify(pkg),
  });
};

test.serial('use main', async (t) => {
  const pkg = {
    name: 'x',
    main: 'index.js',
  };

  mockRepo(pkg);
  const p = await getModuleEntryPoint('x', repoPath);
  t.assert(p?.endsWith('x_1.0.0/index.js'));
});

test.serial('use main with path', async (t) => {
  const pkg = {
    name: 'x',
    main: 'dist/index.js',
  };

  mockRepo(pkg);
  const p = await getModuleEntryPoint('x', repoPath);
  t.assert(p?.endsWith('x_1.0.0/dist/index.js'));
});

test.serial('default to index.js', async (t) => {
  const pkg = {
    name: 'x',
  };

  mockRepo(pkg);
  const p = await getModuleEntryPoint('x', repoPath);
  t.assert(p?.endsWith('x_1.0.0/index.js'));
});

// Issue! The ESM export fails in node19 if the import happens to have
// directory imports (as lodash/fp does). So for now I'm disabling ESM imports.
test.serial.skip('prefer exports to main', async (t) => {
  const pkg = {
    name: 'x',
    main: 'dist/index.cjs',
    exports: './dist/index.js',
  };

  mockRepo(pkg);
  const p = await getModuleEntryPoint('x', repoPath);
  t.assert(p?.endsWith('x_1.0.0/dist/index.js'));
});

test.serial.skip('prefer conditional export to main', async (t) => {
  const pkg = {
    name: 'x',
    main: 'dist/index.cjs',
    exports: {
      '.': './dist/index.js',
    },
  };

  mockRepo(pkg);
  const p = await getModuleEntryPoint('x', repoPath);
  t.assert(p?.endsWith('x_1.0.0/dist/index.js'));
});

test.serial.skip('ignore non-main conditional exports', async (t) => {
  const pkg = {
    name: 'x',
    exports: {
      './util.js': './dist/index.cjs',
      '.': './dist/index.js',
    },
  };

  mockRepo(pkg);
  const p = await getModuleEntryPoint('x', repoPath);
  t.assert(p?.endsWith('x_1.0.0/dist/index.js'));
});

test.serial('support version number', async (t) => {
  const pkg = {
    name: 'x',
    main: './dist/index.js',
  };

  mockRepo(pkg);
  const p = await getModuleEntryPoint('x@1.0.0', repoPath);
  t.assert(p?.endsWith('x_1.0.0/dist/index.js'));
});
