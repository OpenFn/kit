import test from 'ava';
import chalk from 'chalk';
import mockLogger from '../src/mock';

// disable chalk colours in unit tests
chalk.level = 0;

// Explicit unit tests against the mock API
// i.e., check _last, _history, _reset

test('_last returns the last result', (t) => {
  const logger = mockLogger();
  t.deepEqual(logger._last, []);
  logger.success('x');
  const [level, icon ,message] = logger._last;
  t.assert(level === 'success');
  t.truthy(icon);
  t.assert(message === 'x');
});

test('mockLogger forwards the name', (t) => {
  const logger = mockLogger('a');
  t.deepEqual(logger._last, []);
  logger.success('x');
  const [level, name, icon ,message] = logger._last;
  t.assert(name == '[a]')
  t.assert(level === 'success');
  t.truthy(icon);
  t.assert(message === 'x');
});

test('mockLogger forwards the name and options', (t) => {
  const logger = mockLogger('a', { hideIcons: true });
  t.deepEqual(logger._last, []);
  logger.success('x');
  const [level, name, message] = logger._last;
  t.assert(name == '[a]')
  t.assert(level === 'success');
  t.assert(message === 'x');
});

test('_history returns history', (t) => {
  const logger = mockLogger();
  t.assert(logger._history.length === 0);

  logger.success('x');
  t.assert(logger._history.length === 1);
 
  const [level, icon ,message] = logger._history[0];
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
 
  [0,1,2].forEach((index) => {
    const [level, icon ,message] = logger._history[index];
    t.assert(level === 'success');
    t.truthy(icon);
    t.assert(message === index);
  })
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