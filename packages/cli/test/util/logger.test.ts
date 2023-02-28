import test from 'ava';
import createLogger, { createNullLogger } from '../../src/util/logger';
import type { SafeOpts } from '../../src/commands';

test('creates a logger', (t) => {
  const opts = {
    log: {},
  } as SafeOpts;
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
  } as SafeOpts;
  const { options } = createLogger('x', opts);
  t.is(options.level, 'default');
});

test('uses default level if no namespace is provided', (t) => {
  // @ts-ignore ???
  const opts = {
    log: {
      default: 'info',
    },
  } as SafeOpts;
  const { options } = createLogger('x', opts);
  t.is(options.level, 'info');
});

test('uses namespaced level', (t) => {
  // @ts-ignore ???
  const opts = {
    log: {
      default: 'none',
      x: 'debug',
    },
  } as SafeOpts;
  const { options } = createLogger('x', opts);
  t.is(options.level, 'debug');
});

test('createNullLogger: logs to none', (t) => {
  const { options } = createNullLogger();
  t.is(options.level, 'none');
});
