import { createMockLogger } from '@openfn/logger';
import test from 'ava';
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

test('should not warn if no adaptor is passed but skip-adaptor-warning is set', async (t) => {
  await validateAdaptors({ adaptors: [], skipAdaptorValidation: true }, logger);
  t.is(logger._history.length, 0);
});
