import test from 'ava';
import chalk from 'chalk';
import actualCreateLogger, { styleLevel } from '../src/logger';

// disble chalk colours in unit tests
chalk.level = 0

// parse log output into a consumable parts
const parse = ([level, namespace, icon, ...rest ]) => ({
  level,
  namespace,
  icon,
  message: rest.join(' ')
});

type TestLogger = typeof console & {
  _out: any[];
  _last: string[];
}

const icons = {
  info: styleLevel('info'),
  debug: styleLevel('debug'),
  success: styleLevel('success'),
  warn: styleLevel('warn'),
  error: styleLevel('error'),
};

// Create a test log emitter
// The logger will call this with output
function testLogger() {
  const history: any[] = [];
  const logger = {
    ...console,
    _out: history,
    _last: [],
  };
  ['info', 'success', 'debug', 'warn', 'error'].forEach((l) => {
    logger[l] = (...out: any[]) => history.push([l, ...out]);
  });
  Object.defineProperty(logger, '_last', {
    get: () => history[history.length - 1]
  })
  return logger as TestLogger;
};

// Convenience API - looks like the acutal logger API
// But it creates a test  emitter which logs to an array,
// and returns it in a tuple
const createLogger = (name?: string, opts: NamespacedOptions = {}) => {
  const l = testLogger(); 
  
  return [
    actualCreateLogger(name, {
      [name || 'global']: {
        logger: l,
        ...opts
      }
    }),
    l
  ];
};

test('log with defaults', (t) => {
  const [logger, l] = createLogger();
  logger.success('abc');

  // can't use parse here, so we'll do it manually
  const [level, ...rest] = l._last;
  const message = rest.join(' ');
  t.assert(level === 'success');
  t.assert(message === `${icons.success} abc`);
});

// Automated structural tests per level
['success', 'info', 'debug', 'error', 'warn'].forEach((level) => {
  test(`${level} - logs with icon and namespace`, (t) => {
    const options = { level };
    const [logger, l] = createLogger('x', options);
    logger[level]('abc');

    const result = parse(l._last);
    t.assert(result.level === level);
    t.assert(result.namespace === '[x]');
    t.assert(result.icon === icons[level]);
    t.assert(result.message === 'abc');
  });

  test(`${level} - logs without icon`, (t) => {
    const options = { level, hideIcons: true };
    const [logger, l] = createLogger('x', options)
    logger[level]('abc');

    const [_level, _namespace, ..._rest] = l._last;
    const _message = _rest.join('_');
    t.assert(_level === level);
    t.assert(_namespace === '[x]');
    t.assert(_message === 'abc');  });

  test(`${level} - logs without namespace`, (t) => {
    const options = { level, hideNamespace: true };
    const [logger, l] = createLogger('x', options)
    logger[level]('abc');

    const [_level, _icon, ..._rest] = l._last;
    const _message = _rest.join('_');
    t.assert(_level === level);
    t.assert(_icon === icons[level]);
    t.assert(_message === 'abc');
  });
});

test('log() should behave like info', (t) => {
  const options = { level: 'debug' };
  const [logger, l] = createLogger('x', options);
  logger.log('abc');

  const result = parse(l._last);
  t.assert(result.level === 'info');
  t.assert(result.namespace === '[x]');
  t.assert(result.icon === icons.info);
  t.assert(result.message === 'abc');
})


test('with level=none, logs nothing', (t) => {
  // TODO this doesn't give me very documentary-style tests
  // because the signature is actually quite misleading
  const [logger, l] = createLogger(undefined, { level: 'none' });
  logger.success('a');
  logger.info('b');
  logger.debug('c');
  logger.warn('d');
  logger.error('e');
  logger.log('e');

  t.assert(l._out.length === 0);
});

test('with level=default, logs success, error and warning but not info and debug', (t) => {
  const [logger, l] = createLogger('x', { level: 'default' });
  
  logger.debug('d');
  logger.info('i');
  t.assert(l._out.length === 0)

  logger.success('s');
  let result = parse(l._last);
  t.assert(result.level === 'success');
  t.assert(result.message === 's');

  logger.warn('w');
  result = parse(l._last);
  t.assert(result.level === 'warn');
  t.assert(result.message === 'w');

  logger.error('e');
  result = parse(l._last);
  t.assert(result.level === 'error');
  t.assert(result.message === 'e');
});

test('with level=info, logs errors and warnings but not debug', (t) => {
  const options = { level: 'info' };
  const [logger, l] = createLogger('x', options);
  logger.debug('abc');

  t.assert(l._out.length === 0)

  logger.warn('a');
  let result = parse(l._last);
  t.assert(result.level === 'warn');
  t.assert(result.message === 'a');
  
  logger.error('b');
  result = parse(l._last);
  t.assert(result.level === 'error');
  t.assert(result.message === 'b');
});

test('with level=debug logs everything', (t) => {
  const options = { level: 'debug' };
  const [logger, l] = createLogger('x', options);
  logger.info('i');
  let result = parse(l._last);
  t.assert(result.level === 'info');
  t.assert(result.message === 'i');
  
  logger.debug('d');
  result = parse(l._last);
  t.assert(result.level === 'debug');
  t.assert(result.message === 'd');

  logger.warn('w');
  result = parse(l._last);
  t.assert(result.level === 'warn');
  t.assert(result.message === 'w');

  logger.error('e');
  result = parse(l._last);
  t.assert(result.level === 'error');
  t.assert(result.message === 'e');
});