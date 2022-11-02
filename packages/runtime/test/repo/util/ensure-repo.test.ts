import test from 'ava';
import mock from 'mock-fs';
import { createMockLogger } from '@openfn/logger';
import ensureRepo from '../../../src/repo/ensure-repo';

// TODO should the mock logger default to debug?
const logger = createMockLogger('test', { level: 'debug' });

test.afterEach(() => {
  mock.restore();
  logger._reset();
});

const defaultPkg = JSON.stringify({ name: 'test' });

test.serial('return the package json it finds', async (t) => {
  mock({
    '/tmp/repo/package.json': defaultPkg,
  });
  const result = await ensureRepo('/tmp/repo', logger);
  t.truthy(result);
  t.is(result.name, 'test');
});

test.serial('log if a repo exists', async (t) => {
  mock({
    '/tmp/repo/package.json': defaultPkg,
  });
  await ensureRepo('/tmp/repo', logger);
  const { message } = logger._parse(logger._last);
  t.is(message, 'Repo exists');
});

test.serial(
  'do not write the default package if the repo exists',
  async (t) => {
    mock({
      '/tmp/repo/package.json': defaultPkg,
    });
    const result = await ensureRepo('/tmp/repo', logger);
    t.truthy(result);
    t.is(result.name, 'test');
    t.falsy(result.version);
    t.falsy(result.description);
    t.falsy(result.dependencies);
  }
);

test.serial('create a default package if the repo exists', async (t) => {
  mock({});
  const result = await ensureRepo('/tmp/repo', logger);
  t.truthy(result);
  t.is(result.name, 'openfn-repo');
  t.truthy(result.version);
  t.truthy(result.description);
  t.truthy(result.author);
  t.true(result.private);
});

test.serial('log if a repo is created', async (t) => {
  mock({});
  await ensureRepo('/tmp/repo', logger);
  const { message } = logger._parse(logger._last);
  t.assert((message as string).startsWith('Creating new repo'));
});
