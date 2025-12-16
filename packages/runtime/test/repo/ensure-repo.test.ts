import test from 'ava';
import mock from 'mock-fs';
import { createMockLogger } from '@openfn/logger';
import { ensureRepo, loadRepoPkg } from '../../src/modules/repo';

const logger = createMockLogger('test', { level: 'debug' });

test.afterEach(() => {
  mock.restore();
  logger._reset();
});

const defaultPkg = JSON.stringify({ name: 'test' });

test.serial('return the existing package json', async (t) => {
  mock({
    '/tmp/repo/package.json': defaultPkg,
  });
  const result = await ensureRepo('/tmp/repo', logger);
  t.truthy(result);
  t.is(result.name, 'test');
});

test.serial('do not modify the existing package.json', async (t) => {
  mock({
    '/tmp/repo/package.json': defaultPkg,
  });
  const result = await ensureRepo('/tmp/repo', logger);
  t.truthy(result);
  t.is(result.name, 'test');
  t.falsy(result.version);
  t.falsy(result.description);
  t.falsy(result.dependencies);
});

test.serial(
  'create and return a package.json if the repo does not exist',
  async (t) => {
    mock({});
    const result = await ensureRepo('/tmp/repo', logger);
    t.truthy(result);
    t.is(result.name, 'openfn-repo');
    t.truthy(result.version);
    t.truthy(result.description);
    t.truthy(result.author);
    t.true(result.private);

    const pkg = await loadRepoPkg('/tmp/repo');
    t.deepEqual(result, pkg);
  }
);

test.serial(
  'create and return a package if the repo does not exist at a long path',
  async (t) => {
    mock({});
    const result = await ensureRepo('/a/b/c/d/repo', logger);
    t.truthy(result);
    t.is(result.name, 'openfn-repo');

    const pkg = await loadRepoPkg('/a/b/c/d/repo');
    t.deepEqual(result, pkg);
  }
);

test.serial('log if a repo is created', async (t) => {
  mock({});
  await ensureRepo('/tmp/repo', logger);
  const { message } = logger._parse(logger._last);
  t.regex(message as string, /Creating new repo/);
});
