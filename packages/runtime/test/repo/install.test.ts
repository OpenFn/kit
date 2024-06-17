/*
 * These tests use a mock execute function to test the intent of the npm install command
 * Testing with actual installs is left as an exercise for integration testing
 */
import test from 'ava';
import mock from 'mock-fs';
import semver from 'semver';
import { createMockLogger } from '@openfn/logger';
import { install, loadRepoPkg } from '../../src';
import exec from '../../src/util/exec';

const mockLogger = createMockLogger(undefined, { level: 'debug' });

test.afterEach(() => {
  mock.restore();
  mockLogger._reset();
});

test.beforeEach(() => {
  mock({
    '/tmp': {},
  });
});

const mockExec = () => {
  const fn = function (command: string) {
    fn.last = command;
  };

  fn.last = '';

  return fn as unknown as typeof exec;
};

// util to get around some dubious typescript
const getLastCommand = (e: typeof exec) =>
  // @ts-ignore
  e.last as string;

test.serial('init a new repo', async (t) => {
  const exec = mockExec();

  // Using an explicit package specifier here prevents calling out to npm to lookup the latest version
  await install('my-package@1.0.0', '/tmp/repo', mockLogger, exec);

  const pkg = await loadRepoPkg('/tmp/repo');
  t.truthy(pkg);
  t.is(pkg.name, 'openfn-repo');
});

test.serial('try to install a package', async (t) => {
  const exec = mockExec();

  await install('my-package@1.0.0', '/tmp/repo', mockLogger, exec);

  const cmd = getLastCommand(exec);
  t.truthy(cmd);
  // Check the basic shape of the command
  t.true(/(npm install).*(my-package)/.test(cmd));
});

test.serial('try to install multiple packages', async (t) => {
  const exec = mockExec();

  await install(
    // Again, note that we use explicit versioning to prevent calling out to npm
    ['my-package@1.0.0', 'your-package@1.0.0', 'their_package@3.0.0'],
    '/tmp/repo',
    mockLogger,
    exec
  );

  const cmd = getLastCommand(exec);
  // Check the basic shape of the command
  // (this does assume the order of the install command but it should be fine!)
  t.true(
    /(npm install).*(my-package).*(your-package).*(their_package)/.test(cmd)
  );
});

// test the flags to prevent regressions
test.serial('installing should use the correct flags', async (t) => {
  const exec = mockExec();

  await install('my-package@1.0.0', '/tmp/repo', mockLogger, exec);

  const cmd = getLastCommand(exec);
  const flags = cmd
    .split(' ')
    .filter((token: string) => token.startsWith('--'));
  t.assert(flags.length === 3);
  t.assert(flags.includes('--no-audit'));
  t.assert(flags.includes('--no-fund'));
  t.assert(flags.includes('--no-package-lock'));
});

test.serial('install with the correct alias', async (t) => {
  const exec = mockExec();

  await install('my-package@1.0.0', '/tmp/repo', mockLogger, exec);

  const cmd = getLastCommand(exec);
  const [aliasedSpecifier] = cmd
    .split(' ')
    .filter((token: string) => /\@/.test(token));
  t.is(aliasedSpecifier, 'my-package_1.0.0@npm:my-package@1.0.0');
});

test.serial('do nothing if the package is already installed', async (t) => {
  const exec = mockExec();
  mock({
    '/tmp/repo/package.json': JSON.stringify({
      name: 'test',
      dependencies: {
        'my-package_1.0.0': 'npm:my-package@1.0.0',
      },
    }),
  });
  await install('my-package@1.0.0', '/tmp/repo', mockLogger, exec);
  t.falsy(getLastCommand(exec));
});

test.serial('lookup the latest version', async (t) => {
  const exec = mockExec();

  await install('@openfn/language-common', '/tmp/repo', mockLogger, exec);

  const log = mockLogger._find('info', /Looked up latest version/);
  t.truthy(log);

  const cmd = getLastCommand(exec);
  const [aliasedSpecifier] = cmd
    .split(' ')
    .filter((token: string) => /\@/.test(token));
  const [_alias, specifier] = aliasedSpecifier.split('@npm:');
  const [_null, _name, version] = specifier.split('@');
  t.truthy(version);
  // It doesn't matter what version the module is, let's just ensure it's a sensible one
  t.assert(semver.gt(version, '1.0.0'));
});

test.serial('lookup the latest version if @latest', async (t) => {
  const exec = mockExec();

  await install(
    '@openfn/language-common@latest',
    '/tmp/repo',
    mockLogger,
    exec
  );

  const log = mockLogger._find('info', /Looked up latest version/);
  t.truthy(log);

  const cmd = getLastCommand(exec);
  const [aliasedSpecifier] = cmd
    .split(' ')
    .filter((token: string) => /\@/.test(token));
  const [_alias, specifier] = aliasedSpecifier.split('@npm:');
  const [_null, _name, version] = specifier.split('@');
  t.truthy(version);
  // It doesn't matter what version the module is, let's just ensure it's a sensible one
  t.assert(semver.gt(version, '1.0.0'));
});

test.serial('lookup the latest version if @next', async (t) => {
  const exec = mockExec();

  await install('@openfn/language-common@next', '/tmp/repo', mockLogger, exec);

  const log = mockLogger._find('info', /Looked up latest version/);
  t.truthy(log);

  const cmd = getLastCommand(exec);
  const [aliasedSpecifier] = cmd
    .split(' ')
    .filter((token: string) => /\@/.test(token));
  const [_alias, specifier] = aliasedSpecifier.split('@npm:');
  const [_null, _name, version] = specifier.split('@');
  t.truthy(version);
  // It doesn't matter what version the module is, let's just ensure it's a sensible one
  t.assert(semver.gt(version, '1.0.0'));
});
