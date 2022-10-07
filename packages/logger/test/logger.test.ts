import test from 'ava';
import chalk from 'chalk';
import { styleLevel, LogFns } from '../src/logger';
import { defaults as defaultOptions, LogLevel } from '../src/options';
import { SECRET } from '../src/sanitize';

// We're going to run all these tests against the mock logger
// Which is basically thin wrapper around the logger which bypasses
// console and provides an inspection API
import createLogger from '../src/mock';

// disable chalk colours in unit tests
chalk.level = 0;

// Annoying.
const { logger, ...defaultOptionsWithoutLogger } = defaultOptions;

// parse log output into a consumable parts
const parse = ([level, namespace, icon, ...rest]: string[]) => ({
  level,
  namespace,
  icon,
  message: rest.join(' '),
});

const icons: Record<LogFns, string> = {
  log: styleLevel('info'),
  info: styleLevel('info'),
  debug: styleLevel('debug'),
  success: styleLevel('success'),
  warn: styleLevel('warn'),
  error: styleLevel('error'),
};

test('log with defaults', (t) => {
  const logger = createLogger();
  logger.success('abc');

  // can't use parse here, so we'll do it manually
  const [level, ...rest] = logger._last;
  const message = rest.join(' ');
  t.assert(level === 'success');
  t.assert(message === `${icons.success} abc`);
});

test('returns default options', (t) => {
  const { options } = createLogger();
  const { logger, ...optionsWithoutLogger } = options;
  t.deepEqual(optionsWithoutLogger, defaultOptionsWithoutLogger);
});

test('returns custom options', (t) => {
  const { options } = createLogger(undefined, { level: 'debug' });
  const { logger, ...optionsWithoutLogger } = options;
  const expected = {
    ...defaultOptionsWithoutLogger,
    level: 'debug',
  };
  t.deepEqual(optionsWithoutLogger, expected);
});

// Automated structural tests per level
['success', 'info', 'debug', 'error', 'warn'].forEach((l) => {
  // Set up some fiddly type aliases
  const level = l as LogLevel;
  const fn = l as LogFns;

  test(`${level} - logs with icon and namespace`, (t) => {
    const options = { level };
    const logger = createLogger('x', options);
    logger[fn]('abc');

    const result = parse(logger._last);
    t.assert(result.level === level);
    t.assert(result.namespace === '[x]');
    t.assert(result.icon === icons[fn]);
    t.assert(result.message === 'abc');
  });

  test(`${level} - logs without icon`, (t) => {
    const options = { level, hideIcons: true };
    const logger = createLogger('x', options);
    logger[fn]('abc');

    const [_level, _namespace, ..._rest] = logger._last;
    const _message = _rest.join('_');
    t.assert(_level === fn);
    t.assert(_namespace === '[x]');
    t.assert(_message === 'abc');
  });

  test(`${level} - logs without namespace`, (t) => {
    const options = { level, hideNamespace: true };
    const logger = createLogger('x', options);
    logger[fn]('abc');

    const [_level, _icon, ..._rest] = logger._last;
    const _message = _rest.join('_');
    t.assert(_level === fn);
    t.assert(_icon === icons[fn]);
    t.assert(_message === 'abc');
  });
});

test('log() should behave like info', (t) => {
  const options = { level: 'debug' as const };
  const logger = createLogger('x', options);
  logger.log('abc');

  const result = parse(logger._last);
  t.assert(result.level === 'info');
  t.assert(result.namespace === '[x]');
  t.assert(result.icon === icons.info);
  t.assert(result.message === 'abc');
});

test('with level=none, logs nothing', (t) => {
  // TODO this doesn't give me very documentary-style tests
  // because the signature is actually quite misleading
  const logger = createLogger(undefined, { level: 'none' });
  logger.success('a');
  logger.info('b');
  logger.debug('c');
  logger.warn('d');
  logger.error('e');
  logger.log('e');

  t.assert(logger._history.length === 0);
});

test('with level=default, logs success, error and warning but not info and debug', (t) => {
  const logger = createLogger('x', { level: 'default' });

  logger.debug('d');
  logger.info('i');
  t.assert(logger._history.length === 0);

  logger.success('s');
  let result = parse(logger._last);
  t.assert(result.level === 'success');
  t.assert(result.message === 's');

  logger.warn('w');
  result = parse(logger._last);
  t.assert(result.level === 'warn');
  t.assert(result.message === 'w');

  logger.error('e');
  result = parse(logger._last);
  t.assert(result.level === 'error');
  t.assert(result.message === 'e');
});

test('with level=info, logs errors and warnings but not debug', (t) => {
  const options = { level: 'info' as const };
  const logger = createLogger('x', options);
  logger.debug('abc');

  t.assert(logger._history.length === 0);

  logger.warn('a');
  let result = parse(logger._last);
  t.assert(result.level === 'warn');
  t.assert(result.message === 'a');

  logger.error('b');
  result = parse(logger._last);
  t.assert(result.level === 'error');
  t.assert(result.message === 'b');
});

test('with level=debug logs everything', (t) => {
  const options = { level: 'debug' as const };
  const logger = createLogger('x', options);
  logger.info('i');
  let result = parse(logger._last);
  t.assert(result.level === 'info');
  t.assert(result.message === 'i');

  logger.debug('d');
  result = parse(logger._last);
  t.assert(result.level === 'debug');
  t.assert(result.message === 'd');

  logger.warn('w');
  result = parse(logger._last);
  t.assert(result.level === 'warn');
  t.assert(result.message === 'w');

  logger.error('e');
  result = parse(logger._last);
  t.assert(result.level === 'error');
  t.assert(result.message === 'e');
});

test('sanitize state', (t) => {
  const logger = createLogger();
  logger.success({
    configuration: {
      x: 'y',
    },
    data: {},
  });

  const { message } = logger._parse(logger._last);
  // @ts-ignore
  t.is(message.configuration.x, SECRET);
});
