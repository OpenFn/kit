import test from 'ava';
import createLogger, { createNullLogger } from '../../src/util/logger';
import type { Opts } from '../../src/options';

test('creates a logger', (t) => {
  const opts = {
    log: {},
  };
  const logger = createLogger('x', opts);
  t.truthy(logger.success);
  t.truthy(logger.log);
  t.truthy(logger.info);
  t.truthy(logger.warn);
  t.truthy(logger.error);
});

test('uses default level', (t) => {
  const opts = {
    log: {},
  };
  const { options } = createLogger('x', opts);
  t.is(options.level, 'default');
});

test('uses default level if no namespace is provided', (t) => {
  const opts: Opts = {
    log: {
      default: 'info',
    },
  };
  const { options } = createLogger('x', opts);
  t.is(options.level, 'info');
});

test('uses namespaced level', (t) => {
  const opts: Opts = {
    log: {
      default: 'none',
      x: 'debug',
    },
  };
  const { options } = createLogger('x', opts);
  t.is(options.level, 'debug');
});

test('createNullLogger: logs to none', (t) => {
  const { options } = createNullLogger();
  t.is(options.level, 'none');
});
