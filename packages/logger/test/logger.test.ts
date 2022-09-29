import test from 'ava';
import chalk from 'chalk';
import createLogger, { styleLevel } from '../src/logger';

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
  INFO: styleLevel('info'),
  DEBUG: styleLevel('debug')
}

// Create a test log emitter
// The logger will call this with output
function testLogger() {
  const history: any[] = [];
  const logger = {
    ...console,

   info: (...out: any[]) => history.push(['info', ...out]),

    _out: history,
  };
  Object.defineProperty(logger, '_last', {
    get: () => history[history.length - 1]
  })
  return logger as TestLogger;
};

test('log with defaults', (t) => {
  const l = testLogger();

  // TODO not a very nice signature for an anon logger with options!
  const logger = createLogger(undefined, { logger: l });
  logger('abc');

  // can't use parse here, so we'll do it manually
  const [level, ...rest] = l._last;
  const message = rest.join(' ');
  t.assert(level === 'info');
  t.assert(message === `${icons.INFO} abc`);
});

test('info - logs with namespace', (t) => {
  const l = testLogger();

  const logger = createLogger('x', { logger: l });
  logger.info('abc');

  const result = parse(l._last);
  t.assert(result.level === 'info');
  t.assert(result.namespace === '[x]');
  t.assert(result.icon === icons.INFO);
  t.assert(result.message === 'abc');
});

test('info - logs without namespace', (t) => {
  const l = testLogger();

  const logger = createLogger('x', { logger: l, showNamespace: false });
  logger.info('abc');

  const result = parse(l._last);
  t.assert(result.level === 'info');
  t.assert(result.namespace === '[x]');
  t.assert(result.icon === icons.INFO);
  t.assert(result.message === 'abc');
});

test('info - does not log trace or debug', (t) => {
  const l = testLogger();

  const logger = createLogger('x', { logger: l, level: 'info' });
  logger.trace('abc');
  logger.debug('abc');

  t.assert(l._out.length === 0)
});


// test('debug', () => {

// });

// test('trace', () => {

// });

// test('warning', () => {

// });

// test('error', () => {

// });

// test('namespace', () => {

// });
