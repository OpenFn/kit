import test from 'ava';
import mock from 'mock-fs';
import { createMockLogger } from '@openfn/logger';
import { getModulePath } from '../../../src/repo/util';

const logger = createMockLogger();

test.afterEach(() => {
  mock.restore();
  logger._reset();
});

const repoPath = '/tmp/repo/';

const mockPkg = (dependencies: object) => {
  mock({
    [`${repoPath}/package.json`]: JSON.stringify({
      name: 'test',
      private: true,
      dependencies,
    }),
  });
};

test.serial("return null if the package can't be matched", async (t) => {
  const name = '@openfn/language-common';
  mockPkg({});
  const path = await getModulePath(name, repoPath);
  t.is(path, null);
});

test.serial('return the path to a package', async (t) => {
  const name = '@openfn/language-common';
  const alias = `${name}_1.0.0`;
  mockPkg({
    [alias]: '1.0.0',
  });
  const path = await getModulePath(name, repoPath);
  t.is(path, `${repoPath}node_modules/${alias}`);
});

test.serial('return the path to the latest version of a package', async (t) => {
  const name = '@openfn/language-common';
  const aliasLatest = `${name}_1.0.0`;
  mockPkg({
    [`${name}_0.0.1`]: '0.0.1',
    [aliasLatest]: '1.0.0',
    [`${name}_0.99.99`]: '0.99.99',
  });
  const path = await getModulePath(name, repoPath);
  t.is(path, `${repoPath}node_modules/${aliasLatest}`);
});

test.serial('return the path to a specific version of a package', async (t) => {
  const name = '@openfn/language-common';
  const specifier = `${name}@1.0.0`;
  const alias = `${name}_1.0.0`;
  mockPkg({
    [alias]: '1.0.0',
  });
  const path = await getModulePath(specifier, repoPath);
  t.is(path, `${repoPath}node_modules/${alias}`);
});

// TODO return the path to a matching version of a package
