import { createMockLogger } from '@openfn/logger';
import test from 'ava';
import { rmSync } from 'fs';
import mockfs from 'mock-fs';
import validateAdaptors from '../../src/util/validate-adaptor';

const logger = createMockLogger('', { level: 'default' });

test.afterEach(() => {
  logger._reset();
});

test.serial("should not warn if there's an adaptor", async (t) => {
  await validateAdaptors({ adaptors: ['a'] }, logger);
  t.is(logger._history.length, 0);
});

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

test.serial.only(
  "should throw and log if an adaptor can't be found",
  async (t) => {
    mockfs({
      // nothing in the file system
    });

    await t.throwsAsync(
      async () => await validateAdaptors({ adaptors: ['a'] }, logger),
      {
        message: 'Failed to load adaptors',
      }
    );
    const err = logger._parse(logger._history[logger._history.length - 2]);
    t.is(err.message, 'Adaptor a not installed in repo');
    t.is(err.level, 'error');

    const last = logger._parse(logger._last);
    t.is(last.level, 'error');
    t.is(last.message, 'Try adding -i to auto-install it');
  }
);

// TODO test for multiple adaptors
// TODO throw if there's no package json
// TODO throw if the name doesn't match
// TODO throw if the version doesn't match
// TODO success with logging
