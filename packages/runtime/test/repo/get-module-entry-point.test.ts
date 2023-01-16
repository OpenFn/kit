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
    // Mock a repo with one module installed
    [`${repoPath}/package.json`]: JSON.stringify({
      name: 'test',
      private: true,
      dependencies: {
        'x_1.0.0': 'npm:x@1.0.0',
      },
    }),
    [`${repoPath}/node_modules/x_1.0.0/package.json`]: JSON.stringify(pkg),

    // Mock an arbitrary package
    [`/repo/test2/package.json`]: JSON.stringify(pkg),
  });
};

test.serial('load from pkg.main', async (t) => {
  const pkg = {
    name: 'x',
    main: 'index.js',
    version: '1.0.0',
  };

  mockRepo(pkg);
  const result = await getModuleEntryPoint('x', undefined, repoPath);
  t.assert(result?.path.endsWith('x_1.0.0/index.js'));
  t.is(result?.version, '1.0.0');
});

test.serial('load from pkg.main with path', async (t) => {
  const pkg = {
    name: 'x',
    main: 'index.js',
    version: '1.0.1',
  };

  mockRepo(pkg);
  const result = await getModuleEntryPoint('x', '/repo/test2/');
  t.is(result?.path, '/repo/test2/index.js');
  t.is(result?.version, '1.0.1');
});

test.serial('default to index.js', async (t) => {
  const pkg = {
    name: 'x',
    version: '1.0.2',
  };

  mockRepo(pkg);
  const result = await getModuleEntryPoint('x', undefined, repoPath);
  t.assert(result?.path.endsWith('x_1.0.0/index.js'));
  t.is(result?.version, '1.0.2');
});

// Issue! The ESM export fails in node19 if the import happens to have
// directory imports (as lodash/fp does). So for now I'm disabling ESM imports.
test.serial.skip('prefer exports to main', async (t) => {
  const pkg = {
    name: 'x',
    version: '1.0.4',
    main: 'dist/index.cjs',
    exports: './dist/index.js',
  };

  mockRepo(pkg);
  const result = await getModuleEntryPoint('x', undefined, repoPath);
  t.assert(result?.path.endsWith('x_1.0.0/dist/index.js'));
  t.is(result?.version, '1.0.4');
});

test.serial.skip('prefer conditional export to main', async (t) => {
  const pkg = {
    name: 'x',
    version: '1.0.5',
    main: 'dist/index.cjs',
    exports: {
      '.': './dist/index.js',
    },
  };

  mockRepo(pkg);
  const result = await getModuleEntryPoint('x', undefined, repoPath);
  t.assert(result?.path.endsWith('x_1.0.0/dist/index.js'));
  t.is(result?.version, '1.0.5');
});

test.serial.skip('ignore non-main conditional exports', async (t) => {
  const pkg = {
    name: 'x',
    version: '1.0.6',
    exports: {
      './util.js': './dist/index.cjs',
      '.': './dist/index.js',
    },
  };

  mockRepo(pkg);
  const result = await getModuleEntryPoint('x', undefined, repoPath);
  t.assert(result?.path.endsWith('x_1.0.0/dist/index.js'));
  t.is(result?.version, '1.0.6');
});

test.serial('support version number', async (t) => {
  const pkg = {
    name: 'x',
    version: '1.0.7',
    main: './dist/index.js',
  };

  mockRepo(pkg);
  const result = await getModuleEntryPoint('x@1.0.0', undefined, repoPath);
  t.assert(result?.path.endsWith('x_1.0.0/dist/index.js'));
  t.is(result?.version, '1.0.7');
});
