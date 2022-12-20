import { createMockLogger } from '@openfn/logger';
import test from 'ava';
import mockfs from 'mock-fs';
import validateAdaptors from '../../src/util/validate-adaptor';

const logger = createMockLogger('', { level: 'default' });

test.afterEach(() => {
  logger._reset();
  mockfs.restore();
});

const repoDir = '/repo/';

// TODO I have to pass a version in explicitly now, which alters the test path heavily
// But I don't want to call out to npm version for @latest...

test.serial('should report the version if all is OK', async (t) => {
  mockfs({
    '/repo/package.json':
      '{ "name": "repo", "dependencies": {  "a_1.0.0": "npm:a@1.0.0" } }',
    '/repo/node_modules/a_1.0.0/package.json':
      '{ "name": "a", "version": "1.0.0" }',
  });

  await validateAdaptors({ adaptors: ['a@1.0.0'], repoDir }, logger);
  const { message, level } = logger._parse(logger._last);
  t.is(level, 'success');
  t.is(message, 'Adaptor a@1.0.0: OK');
});

test.serial(
  'should report the version if all is OK with a specifc path',
  async (t) => {
    mockfs({
      '/repo/a/package.json': '{ "name": "a", "version": "1.0.0" }',
    });

    await validateAdaptors({ adaptors: ['a=/repo/a'], repoDir }, logger);

    const { message, level } = logger._parse(logger._last);
    t.is(level, 'success');
    t.is(message, 'Adaptor a@1.0.0: OK');
  }
);

test.serial(
  'should throw and report if the module is not found in the repo',
  async (t) => {
    mockfs({
      // The reepo declares the package
      '/repo/package.json':
        '{ "name": "repo", "dependencies": {  "a_1.0.0": "npm:a@1.0.0" } }',
      // But the actual folder is empty!
      '/repo/node_modules': {},
    });

    await t.throwsAsync(
      async () =>
        await validateAdaptors({ adaptors: ['a@1.0.0'], repoDir }, logger),
      {
        message: 'Failed to load adaptors',
      }
    );
    const [err1, err2, err3] = logger._history;
    const fail = logger._parse(err1);
    t.is(fail.level, 'error');
    t.is(
      fail.message,
      'Failed to load adaptor from repo at /repo/node_modules/a_1.0.0/package.json'
    );

    const corrupt = logger._parse(err2);
    t.is(corrupt.level, 'error');
    t.is(corrupt.message, 'Your repo may be corrupt');

    const stacktrace = logger._parse(err3);
    t.is(stacktrace.level, 'error');
    t.regex((stacktrace.message as Error).message, /no such file or directory/);
  }
);

test.serial(
  'should throw and report if the module JSON is invalid',
  async (t) => {
    mockfs({
      // The reepo declares the package
      '/repo/package.json':
        '{ "name": "repo", "dependencies": {  "a_1.0.0": "npm:a@1.0.0" } }',
      // But the actual folder is empty!
      '/repo/node_modules/a_1.0.0/package.json': '@@@@',
    });

    await t.throwsAsync(
      async () =>
        await validateAdaptors({ adaptors: ['a@1.0.0'], repoDir }, logger),
      {
        message: 'Failed to load adaptors',
      }
    );
    const [err1, err2, err3] = logger._history;
    const fail = logger._parse(err1);
    t.is(fail.level, 'error');
    t.is(
      fail.message,
      'Failed to load adaptor from repo at /repo/node_modules/a_1.0.0/package.json'
    );

    const corrupt = logger._parse(err2);
    t.is(corrupt.level, 'error');
    t.is(corrupt.message, 'Your repo may be corrupt');

    const stacktrace = logger._parse(err3);
    t.is(stacktrace.level, 'error');
    t.regex((stacktrace.message as Error).message, /Unexpected token @/);
  }
);

test.serial('should throw if a mismatching version is found', async (t) => {
  mockfs({
    '/repo/package.json':
      '{ "name": "repo", "dependencies": {  "a_1.0.0": "npm:a@1.0.0" } }',
    '/repo/node_modules/a_1.0.0/package.json':
      '{ "name": "a", "version": "9.9.9" }',
  });

  await t.throwsAsync(
    async () =>
      await validateAdaptors({ adaptors: ['a@1.0.0'], repoDir }, logger),
    {
      message: 'Failed to load adaptors',
    }
  );
  const [err1, err2] = logger._history;
  const fail = logger._parse(err1);
  t.is(fail.level, 'error');
  t.is(fail.message, 'Adaptor version mismatch');

  const corrupt = logger._parse(err2);
  t.is(corrupt.level, 'error');
  t.is(corrupt.message, 'Looked in repo for a@1.0.0, but found 9.9.9');
});

test.serial(
  'should throw and report module if a bad path is passed',
  async (t) => {
    mockfs({
      '/': {},
    });

    await t.throwsAsync(
      async () =>
        await validateAdaptors({ adaptors: ['a=/repo/a'], repoDir }, logger),
      {
        message: 'Failed to load adaptors',
      }
    );
    const [err1, err2] = logger._history;
    const fail = logger._parse(err1);
    t.is(fail.level, 'error');
    t.is(
      fail.message,
      'Failed to load adaptor from path at /repo/a/package.json'
    );

    const stacktrace = logger._parse(err2);
    t.is(stacktrace.level, 'error');
    t.regex((stacktrace.message as Error).message, /no such file or directory/);
  }
);

test.serial('should warn if no adaptor is passed', async (t) => {
  await validateAdaptors({ adaptors: [] }, logger);
  t.assert(logger._history.length > 1);
  const { message, level } = logger._parse(logger._history[0]);
  t.is(level, 'warn');
  t.regex(message as string, /No adaptor provided/);
});

test.serial(
  'should not warn if no adaptor is passed but skip-adaptor-warning is set',
  async (t) => {
    await validateAdaptors(
      { adaptors: [], skipAdaptorValidation: true },
      logger
    );
    t.is(logger._history.length, 0);
  }
);

test.serial(
  "should throw and log if an adaptor can't be found in the repo",
  async (t) => {
    mockfs({
      // nothing in the file system
    });

    await t.throwsAsync(
      async () => await validateAdaptors({ adaptors: ['a@1.0.0'] }, logger),
      {
        message: 'Failed to load adaptors',
      }
    );
    const err = logger._parse(logger._history[logger._history.length - 2]);
    t.is(err.message, 'Adaptor a@1.0.0 not installed in repo');
    t.is(err.level, 'error');

    const last = logger._parse(logger._last);
    t.is(last.level, 'error');
    t.is(last.message, 'Try adding -i to auto-install it');
  }
);
