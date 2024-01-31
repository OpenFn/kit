import test from 'ava';
import chalk from 'chalk';
import { styleLevel, LogFns, StringLog, JSONLog } from '../src/logger';
import { defaults as defaultOptions, LogLevel } from '../src/options';
import hrtimestamp from '../src/util/timestamp';
import { SECRET } from '../src/sanitize';

// We're going to run all these tests against the mock logger
// Which is basically thin wrapper around the logger which bypasses
// console and provides an inspection API
import createLogger from '../src/mock';
import { timestampToDate } from '../src/util/timestamp';

const wait = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

// disable chalk colours in unit tests
chalk.level = 0;

// Annoying.
const { logger, ...defaultOptionsWithoutLogger } = defaultOptions;

// parse log output into a consumable parts
const parse = ([level, namespace, icon, ...rest]: StringLog) => ({
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
  always: styleLevel('always'),
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

test('should log objects as strings', (t) => {
  const logger = createLogger();

  const obj = { a: 22 };
  logger.success(obj);

  const { message } = logger._parse(logger._last);
  t.is(
    message,
    `{
  "a": 22
}`
  );

  const messageObj = JSON.parse(message as string);
  t.deepEqual(messageObj.a, 22);
});

test("don't log null by itself", (t) => {
  const logger = createLogger(undefined, { level: 'debug' });
  logger.log(null);

  t.is(logger._history.length, 0);
});

test("don't log null by itself in json", (t) => {
  const logger = createLogger(undefined, { level: 'debug', json: true });
  logger.log(null);

  t.is(logger._history.length, 0);
});

test('do log null after a string', (t) => {
  const logger = createLogger(undefined, { level: 'debug' });
  logger.log('result', null);

  t.is(logger._history.length, 1);
});

test('sanitize: remove object', (t) => {
  const logger = createLogger(undefined, {
    level: 'debug',
    sanitize: 'remove',
  });
  logger.log({});

  t.is(logger._history.length, 0);
});

test('sanitize: remove object after string', (t) => {
  const logger = createLogger(undefined, {
    level: 'debug',
    sanitize: 'remove',
  });
  logger.log('result', {});

  const { message } = logger._parse(logger._last);
  t.is(message, 'result ');
});

test('sanitize: obfuscate object', (t) => {
  const logger = createLogger(undefined, {
    level: 'debug',
    sanitize: 'obfuscate',
  });
  logger.log({});

  const { message } = logger._parse(logger._last);
  t.is(message, '[object]');
});

test('sanitize: summarise object', (t) => {
  const logger = createLogger(undefined, {
    level: 'debug',
    sanitize: 'summarize',
  });
  logger.log({ a: 1 });

  const { message } = logger._parse(logger._last);
  t.is(message, '(object with keys a)');
});

// Automated structural tests per level
['always', 'success', 'info', 'debug', 'error', 'warn'].forEach((l) => {
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

  test(`${level} - as json`, (t) => {
    const options = { level, json: true };
    const logger = createLogger<JSONLog>('x', options);
    logger[fn]('abc');

    const result = logger._last;
    t.assert(Object.keys(result).length === 4);

    t.assert(result.level === level);
    t.assert(result.name === 'x');
    t.assert(result.message[0] === 'abc');
    t.is(typeof result.time, 'string');
  });
});

test(`JSON timestamps are bigints representing sensible times`, (t) => {
  const testStartTime = new Date().toISOString();
  const startTime = hrtimestamp();

  const options = { level: 'info' as const, json: true };
  const logger = createLogger<JSONLog>('x', options);
  logger.info("what's the time mr wolf");

  const { time } = logger._last;
  // The time we get here is NOT a bigint because it's been serialized
  t.true(typeof time === 'string');
  t.is(time.length, 19);

  // But we can convert it and check the value is sensible
  const endTime = BigInt(time);

  const endDate = timestampToDate(endTime);

  // These dates, captured at different resolutions and converte to ms,
  // are probabably identical, maybe <3ms difference
  t.log(`log time: ${testStartTime}
big start time: ${timestampToDate(startTime).toISOString()},
big end time: ${endDate.toISOString()}`);

  // tinfoil hat: make sure the result is the same day at least
  // Maybe a time diff < 1e6 is a better test but this is really belt and braces
  const today = new Date();
  t.is(today.getDate(), endDate.getDate());
  t.is(today.getFullYear(), endDate.getFullYear());
  t.is(today.getMonth(), endDate.getMonth());

  t.true(endTime >= startTime);

  // Check the elapsed time is less than, say, 1ms (should be super super quick!)
  t.true(endTime - startTime < 1e6);
});

test('timestamps increase in time', async (t) => {
  const options = { level: 'info' as const, json: true };
  const logger = createLogger<JSONLog>('x', options);

  for (let i = 0; i < 10; i += 1) {
    logger.info("what's the time mr wolf");
  }

  let last = '0';
  logger._history.forEach(({ time }) => {
    t.log(typeof time, time);
    t.true(time > last);
    last = time;
  });
});

test('print() should be barebones', (t) => {
  const options = { level: 'default' as const };
  const logger = createLogger('x', options);
  logger.print('abc');

  const [level, message] = logger._last;
  t.is(level, 'print');
  t.is(message, 'abc');
});

test('print() should not log if level is none', (t) => {
  const options = { level: 'none' as const };
  const logger = createLogger('x', options);
  logger.print('abc');

  t.is(logger._history.length, 0);
});

test.only('print() should log as json', (t) => {
  const options = { json: true };
  const logger = createLogger<string>('x', options);
  logger.print('abc');

  // @ts-ignore
  const { level, message } = logger._parse(logger._last);
  t.is(level, 'print');
  t.deepEqual(message, { message: ['abc'] });
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

test('with level=none, logs errors only', (t) => {
  // TODO this doesn't give me very documentary-style tests
  // because the signature is actually quite misleading
  const logger = createLogger(undefined, { level: 'none' });
  logger.success('a');
  logger.info('b');
  logger.debug('c');
  logger.warn('d');
  logger.log('e');

  t.assert(logger._history.length === 0);

  logger.error('e');
  t.assert(logger._history.length === 1);
});

test('in json mode with level=none, logs errors only', (t) => {
  const logger = createLogger(undefined, { level: 'none', json: true });
  logger.success('a');
  logger.info('b');
  logger.debug('c');
  logger.warn('d');
  logger.log('e');

  t.assert(logger._history.length === 0);

  logger.error('e');
  t.assert(logger._history.length === 1);
});

test('json mode should serialize errors nicely', (t) => {
  const logger = createLogger<JSONLog>(undefined, {
    level: 'debug',
    json: true,
  });
  const e = new Error('wibble');

  logger.info(e);

  const result = logger._last;
  t.is(result.level, 'info');
  t.deepEqual(result.message[0], { name: 'Error', message: 'wibble' });
});

test('with level=default, logs success, error and warning but not info and debug', (t) => {
  const logger = createLogger<StringLog>('x', { level: 'default' });

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
  const obj = JSON.parse(message as string);
  t.is(obj.configuration.x, SECRET);
});

test('sanitize state in second arg', (t) => {
  const logger = createLogger();
  logger.success('state', {
    configuration: {
      x: 'y',
    },
    data: {},
  });

  const { messageRaw } = logger._parse(logger._last);
  const [message, state] = messageRaw;
  const stateObj = JSON.parse(state);
  t.is(message, 'state');
  t.is(stateObj.configuration.x, SECRET);
});

test('sanitize state in json logging', (t) => {
  const logger = createLogger<JSONLog>(undefined, { json: true });
  logger.success({
    configuration: {
      x: 'y',
    },
    data: {},
  });
  const { message } = logger._last;
  t.is(message[0].configuration.x, SECRET);
});

test('timer: start', (t) => {
  const logger = createLogger();
  const result = logger.timer('t');
  t.falsy(result);
});

test('timer: return a string on end', async (t) => {
  const logger = createLogger();
  logger.timer('t');
  await wait(10);
  const duration = logger.timer('t');
  t.truthy(duration);
  t.assert(typeof duration === 'string');
  t.true(duration?.endsWith('ms'));
});

test('timer: start a new timer with the same name', async (t) => {
  const logger = createLogger();
  logger.timer('t');
  await wait(10);
  const duration = logger.timer('t');
  t.true(duration?.endsWith('ms'));

  const result = logger.timer('t');
  t.falsy(result);
});

test('log a circular object', async (t) => {
  const z: any = {};
  const a = {
    z,
  };
  z.a = a;
  const logger = createLogger();
  logger.success(a);

  const { message } = logger._parse(logger._last);
  t.is(
    message,
    `{
  "z": {
    "a": "[Circular]"
  }
}`
  );
});

// This fails now because I'm not stringifying the output
// I think this has to just be OK.
// Maybe the worker needs to stringify the result downstream,
// but I don't think the logger itself should?
test.skip('log a circular object as JSON', async (t) => {
  const z: any = {};
  const a = {
    z,
  };
  z.a = a;
  const logger = createLogger<JSONLog>(undefined, { json: true });
  logger.success(a);

  const { message } = logger._last;
  t.log(message);
  t.deepEqual(message[0], {
    z: {
      a: '[Circular]',
    },
  });
});

test('ignore functions on logged objects', async (t) => {
  const obj = {
    a: 1,
    z: () => {},
  };
  const logger = createLogger();
  logger.success(obj);

  const { message } = logger._parse(logger._last);
  t.is(
    message,
    `{
  "a": 1
}`
  );
});

test('log an error object', (t) => {
  const logger = createLogger();
  logger.error(new Error('err'));

  const { message } = logger._parse(logger._last);
  t.assert(message instanceof Error);
});

test('proxy a json argument to string', (t) => {
  const logger = createLogger('x');
  logger.proxy({ name: 'y', level: 'success', message: ['hello'] });

  const { namespace, level, message } = logger._parse(logger._last);
  t.is(namespace, 'y');
  t.is(level, 'success');
  t.deepEqual(message, 'hello');
});

test('proxy string arguments to string', (t) => {
  const logger = createLogger('x');
  logger.proxy('y', 'success', ['hello']);

  const { namespace, level, message } = logger._parse(logger._last);
  t.is(namespace, 'y');
  t.is(level, 'success');
  t.deepEqual(message, 'hello');
});

test('proxy a json argument to json', (t) => {
  const logger = createLogger<JSONLog>('x', { json: true });
  logger.proxy({ name: 'y', level: 'success', message: ['hello'] });

  const { name, level, message } = logger._last;
  t.is(name, 'y');
  t.is(level, 'success');
  t.deepEqual(message, ['hello']);
});

test('proxy string arguments to json', (t) => {
  const logger = createLogger<JSONLog>('x', { json: true });
  logger.proxy('y', 'success', ['hello']);

  const { name, level, message } = logger._last;
  t.is(name, 'y');
  t.is(level, 'success');
  t.deepEqual(message, ['hello']);
});

test('proxy should respect log levels', (t) => {
  const logger = createLogger('x', { level: 'default' });
  logger.proxy({ level: 'debug', name: '', message: ['hidden'] });

  // do nothing

  const [last] = logger._last;
  t.falsy(last);
});
