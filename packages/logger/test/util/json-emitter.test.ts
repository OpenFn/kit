import test from 'ava';
import jsonEmitter from '../../src/util/json-emitter';
import { LogFns } from '../../src/logger';

const levels: LogFns[] = [
  'log',
  'info',
  'success',
  'always',
  'debug',
  'warn',
  'error',
];

const history: any[] = [];

test.before(() => {
  // All json functions emit to log - so we just have to override that one function here
  console.log = (...args: any[]) => {
    history.push(args);
  };
});

levels.forEach((level) => {
  test(`should log a string to ${level}`, (t) => {
    jsonEmitter[level]('hello');

    const last = history.pop();
    t.is(last.length, 1);
    t.is(last[0], '"hello"');
  });

  test(`should log a number to ${level}`, (t) => {
    jsonEmitter[level](1);

    const last = history.pop();
    t.is(last.length, 1);
    t.is(last[0], '1');
  });

  test(`should log a boolean to ${level}`, (t) => {
    jsonEmitter[level](false);

    const last = history.pop();
    t.is(last.length, 1);
    t.is(last[0], 'false');
  });

  test(`should log an error to ${level}`, (t) => {
    jsonEmitter[level](new Error('err'));

    const last = history.pop();
    t.is(last.length, 1);
    t.is(last[0], '{}');
  });

  test(`should log an object to ${level}`, (t) => {
    const o = { a: 1, b: 2, c: 3 };
    jsonEmitter[level](o);

    const last = history.pop();
    t.is(last.length, 1);
    t.is(last[0], JSON.stringify(o));
  });
});
