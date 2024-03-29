import test from 'ava';
import chalk from 'chalk';
import mockLogger from '../src/mock';
import { JSONLog } from '../src';

// disable chalk colours in unit tests
chalk.level = 0;

// Explicit unit tests against the mock API
// i.e., check _last, _history, _reset

test('_last returns the last result', (t) => {
  const logger = mockLogger();
  t.deepEqual(logger._last, []);
  logger.success('x');
  const [level, icon, message] = logger._last;
  t.assert(level === 'success');
  t.truthy(icon);
  t.assert(message === 'x');
});

test('mockLogger forwards the name', (t) => {
  const logger = mockLogger('a');
  t.deepEqual(logger._last, []);
  logger.success('x');
  const [level, name, icon, message] = logger._last;
  t.assert(name == '[a]');
  t.assert(level === 'success');
  t.truthy(icon);
  t.assert(message === 'x');
});

test('mockLogger forwards the name and options', (t) => {
  const logger = mockLogger('a', { hideIcons: true });
  t.deepEqual(logger._last, []);
  logger.success('x');
  const [level, name, message] = logger._last;
  t.assert(name == '[a]');
  t.assert(level === 'success');
  t.assert(message === 'x');
});

test('_history returns history', (t) => {
  const logger = mockLogger();
  t.assert(logger._history.length === 0);

  logger.success('x');
  t.assert(logger._history.length === 1);

  const [level, icon, message] = logger._history[0];
  t.assert(level === 'success');
  t.truthy(icon);
  t.assert(message === 'x');
});

test('_history returns all history', (t) => {
  const logger = mockLogger();
  t.assert(logger._history.length === 0);

  logger.success(0);
  logger.success(1);
  logger.success(2);
  t.assert(logger._history.length === 3);

  [0, 1, 2].forEach((index) => {
    const [level, icon, message] = logger._history[index];
    t.assert(level === 'success');
    t.truthy(icon);
    t.assert(message === index);
  });
});

test('_reset removes history and last', (t) => {
  const logger = mockLogger();

  logger.success('x');
  t.assert(logger._history.length === 1);
  t.truthy(logger._last);

  logger._reset();
  t.assert(logger._history.length === 0);
  t.deepEqual(logger._last, []);
});

// TODO crunch through all the parse settings here
test('_parse with default settings', (t) => {
  const logger = mockLogger();
  logger.success('x');

  const { level, icon, namespace, message } = logger._parse(logger._last);
  t.assert(level === 'success');
  t.truthy(icon);
  t.assert(message === 'x');
  t.falsy(namespace);
});

test('_parse raw message', (t) => {
  const logger = mockLogger();
  logger.success('x', 1, true);

  const { messageRaw } = logger._parse(logger._last);

  t.is(messageRaw[0], 'x');
  t.is(messageRaw[1], 1);
  t.true(messageRaw[2]);
});

test('_parse with a namespace', (t) => {
  const logger = mockLogger('a');
  logger.success('x');

  const { level, icon, namespace, message } = logger._parse(logger._last);
  t.is(level, 'success');
  t.is(namespace, 'a');
  t.truthy(icon);
  t.is(message, 'x');
});

test('_parse with a disabled namespace', (t) => {
  const logger = mockLogger('a', { hideNamespace: true });
  logger.success('x');

  const { level, icon, namespace, message } = logger._parse(logger._last);
  t.is(level, 'success');
  t.truthy(icon);
  t.is(message, 'x');
  t.falsy(namespace);
});

test('_parse with a disabled icon', (t) => {
  const logger = mockLogger('a', { hideIcons: true });
  logger.success('x');

  const { level, icon, namespace, message } = logger._parse(logger._last);
  t.is(namespace, 'a');
  t.is(level, 'success');
  t.is(message, 'x');
  t.falsy(icon);
});

test('_parse with a disabled icon and namespace', (t) => {
  const logger = mockLogger('a', { hideIcons: true, hideNamespace: true });
  logger.success('x');

  const { level, icon, namespace, message } = logger._parse(logger._last);
  t.is(level, 'success');
  t.is(message, 'x');
  t.falsy(namespace);
  t.falsy(icon);
});

test('_parse with multiple log arguments', (t) => {
  const logger = mockLogger('a');
  logger.success('x', 'y', 'z');

  const { level, icon, namespace, message } = logger._parse(logger._last);
  t.is(level, 'success');
  t.is(namespace, 'a');
  t.truthy(icon);
  t.is(message, 'x y z');
});

test('confirm should log and return true', async (t) => {
  const logger = mockLogger('a');
  const result = await logger.confirm('really?');

  t.true(result);

  const { level, message } = logger._parse(logger._last);
  t.is(level, 'confirm');
  t.is(message, 'really?');
});

test('print should include the message', async (t) => {
  const logger = mockLogger('a');
  logger.print('z');

  const { level, message } = logger._parse(logger._last);
  t.is(level, 'print');
  t.is(message, 'z');
});

test('log JSON', async (t) => {
  const logger = mockLogger<JSONLog>('a', { json: true });
  logger.success('z');

  const { level, message, name, time } = logger._last;
  t.is(name, 'a');
  t.is(level, 'success');
  t.is(message[0], 'z');
  t.true(typeof time === 'string');
});

test('find a log', (t) => {
  const logger = mockLogger('a');
  logger.success('hello');

  const result = logger._find('success', /hello/);

  t.truthy(result);
  t.is(result?.level, 'success');
  t.is(result?.message, 'hello');
});

test('find a log with many entries', (t) => {
  const logger = mockLogger('a');
  logger.success('x');
  logger.success('y');
  logger.success('z');
  logger.success('hello');

  const result = logger._find('success', /hello/);

  t.truthy(result);
  t.is(result?.level, 'success');
  t.is(result?.message, 'hello');
});

test('find a log at the right level', (t) => {
  const logger = mockLogger('a', { level: 'debug' });
  logger.info('hello i');
  logger.debug('hello d');
  logger.success('hello s');

  const result = logger._find('debug', /hello/);

  t.truthy(result);
  t.is(result?.level, 'debug');
  t.is(result?.message, 'hello d');
});

test('find the first matching log', (t) => {
  const logger = mockLogger('a');
  logger.success('x');
  logger.success('hello a');
  logger.success('hello b');

  const result = logger._find('success', /hello/);

  t.truthy(result);
  t.is(result?.level, 'success');
  t.is(result?.message, 'hello a');
});

test("return undefined if a log isn't found", (t) => {
  const logger = mockLogger('a');
  logger.info('hello');

  const result = logger._find('success', /hello/);

  t.falsy(result);
});
