import test from 'ava';
import { mockFs, restoreFs } from '@openfn/test-helpers';
import { createMockLogger } from '@openfn/logger';

import load, { report } from '../src/env';

test.afterEach(restoreFs);

const logger = createMockLogger(undefined, { level: 'debug' });

test.afterEach(() => {
  logger._reset();
});

test.serial('should load and return values from .env', (t) => {
  mockFs({
    '/.env': `
      FOO: BAR
    `,
  });

  const env = load('/.env');
  t.deepEqual(env, {
    FOO: 'BAR',
  });
});

test.serial('should report values loaded from .env', (t) => {
  mockFs({
    '/.env': `
      FOO: BAR
    `,
  });

  load('/.env');

  report(logger);

  const a = logger._find('always', /imported 1 env vars/i);
  t.truthy(a);

  const b = logger._find('debug', /set from .env:/i);
  t.truthy(b);

  const c = logger._find('debug', /FOO/);
  t.truthy(c);
});

test.serial('should return null if no env is found', (t) => {
  mockFs({});

  const env = load('/.env');
  t.is(env, null);
});

test.serial('should log if no env is found', (t) => {
  mockFs({});

  load('/.env');

  report(logger);

  const a = logger._find('debug', /.env not found/i);
  t.truthy(a);
});

test.serial('should use $DOT_ENV_OVERRIDES found', (t) => {
  mockFs({});

  // don't load .env
  // but set this magic env var instead
  process.env.$DOT_ENV_OVERRIDES = 'FOO,BAR';

  report(logger);

  const a = logger._find('always', /imported 1 env vars/i);
  t.truthy(a);

  const b = logger._find('debug', /set from .env:/i);
  t.truthy(b);

  const c = logger._find('debug', /FOO, BAR/);
  t.truthy(c);
});
