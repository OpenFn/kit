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

const history: Record<string, any[]> = {};

test.before(() => {
  levels.forEach((l) => {
    history[l] = [];

    // Override the console object
    // the json emitter should redirect here
    // @ts-ignore add success function
    console[l] = (...args: any[]) => {
      history[l].push(args);
    };
  });
});

levels.forEach((level) => {
  test(`should log a string to ${level}`, (t) => {
    jsonEmitter[level]('hello');

    const last = history[level].pop();
    t.is(last.length, 1);
    t.is(last[0], '"hello"');
  });

  test(`should log a number to ${level}`, (t) => {
    jsonEmitter[level](1);

    const last = history[level].pop();
    t.is(last.length, 1);
    t.is(last[0], '1');
  });

  test(`should log a boolean to ${level}`, (t) => {
    jsonEmitter[level](false);

    const last = history[level].pop();
    t.is(last.length, 1);
    t.is(last[0], 'false');
  });

  test(`should log an error to ${level}`, (t) => {
    jsonEmitter[level](new Error('err'));

    const last = history[level].pop();
    t.is(last.length, 1);
    t.is(last[0], '{}');
  });

  test(`should log an object to ${level}`, (t) => {
    const o = { a: 1, b: 2, c: 3 };
    jsonEmitter[level](o);

    const last = history[level].pop();
    t.is(last.length, 1);
    t.is(last[0], JSON.stringify(o));
  });
});
