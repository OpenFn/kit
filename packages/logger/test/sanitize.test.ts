import test from 'ava';

import sanitize, { SECRET } from '../src/sanitize';

test('simply return a string', (t) => {
  const result = sanitize('x');
  t.is(result, 'x');
});

test('simply return null', (t) => {
  const result = sanitize(null);
  t.true(result === null);
});

test('simply return a number', (t) => {
  const result = sanitize(0);
  t.true(result === 0);
});


test('simply return true', (t) => {
  const result = sanitize(true);
  t.true(result);
});

test('simply return false', (t) => {
  const result = sanitize(false);
  t.false(result);
});

test('simply return undefined', (t) => {
  const result = sanitize(undefined);
  t.deepEqual(result, undefined);
});

test("don't stringify errors", (t) => {
  const e = new Error('test');
  const result = sanitize(e);
  t.assert(result instanceof Error);
});

test("Don't stringify ReferenceError", (t) => {
  const e = new ReferenceError('test');
  const result = sanitize(e);
  t.assert(result instanceof ReferenceError);
});

test("Don't stringify a custom error", (t) => {
  class CustomError extends Error {}
  const e = new CustomError('test');
  const result = sanitize(e);
  t.assert(result instanceof Error);
});

test('do stringify an error if asked to', (t) => {
  const e = new Error('test');
  const result = sanitize(e, { serializeErrors: true });
  t.deepEqual(result, {
    name: 'Error',
    message: 'test',
  });
});

test('stringify an object', (t) => {
  const result = sanitize({});
  t.is(result, '{}');
});

test('stringify an array', (t) => {
  const result = sanitize([]);
  t.is(result, '[]');
});

test('sanitize state.configuration', (t) => {
  const state = {
    configuration: { password: 'password1', username: 'foo' },
    data: { x: 1 },
  };
  const expectedState = {
    configuration: { password: SECRET, username: SECRET },
    data: { x: 1 },
  };

  const result = sanitize(state);
  const json = JSON.parse(result);

  t.deepEqual(json, expectedState);
});

test('sanitize if no data is passed', (t) => {
  const state = {
    configuration: { password: 'password1', username: 'foo' },
  };
  const expectedState = {
    configuration: { password: SECRET, username: SECRET },
  };

  const result = sanitize(state);
  const json = JSON.parse(result);

  t.deepEqual(json, expectedState);
});

test('preserve top level stuff after sanitizing', (t) => {
  const state = {
    configuration: { password: 'password1', username: 'foo' },
    jam: 'jar',
  };
  const expectedState = {
    configuration: { password: SECRET, username: SECRET },
    jam: 'jar',
  };

  const result = sanitize(state);
  const json = JSON.parse(result);

  t.deepEqual(json, expectedState);
});

test("don't blow up on null prototypes", (t) => {
  const obj = Object.create(null)
  const result = sanitize(obj);

  t.deepEqual(result, '{}');
});

test('ignore a string with obfuscation', (t) => {
  const result = sanitize('x', { policy: 'obfuscate' });
  t.is(result, 'x');
});

test('sanitize array with obfuscation', (t) => {
  const result = sanitize([], { policy: 'obfuscate' });
  t.is(result, '[array]');
});

test('sanitize object with obfuscation', (t) => {
  const result = sanitize({}, { policy: 'obfuscate' });
  t.is(result, '[object]');
});

test('ignore a string with remove', (t) => {
  const result = sanitize('x', { policy: 'remove' });
  t.is(result, 'x');
});

test('sanitize object with remove', (t) => {
  const result = sanitize({}, { policy: 'remove' });
  t.is(result, null);
});

test('sanitize array with remove', (t) => {
  const result = sanitize([1, '2', null, {}], { policy: 'remove' });
  t.deepEqual(result, null);
});

test('ignore a string with summarize', (t) => {
  const result = sanitize('x', { policy: 'summarize' });
  t.is(result, 'x');
});

test('sanitize empty object with summarize', (t) => {
  const result = sanitize({}, { policy: 'summarize' });
  t.is(result, '(empty object)');
});

test('sanitize object with summarize', (t) => {
  const result = sanitize({ b: 1, a: 2 }, { policy: 'summarize' });
  t.is(result, '(object with keys a, b)');
});

test('sanitize empty array with summarize', (t) => {
  const result = sanitize([], { policy: 'summarize' });
  t.is(result, '(empty array)');
});

test('sanitize array with summarize', (t) => {
  const result = sanitize([{}, {}, {}], { policy: 'summarize' });
  t.is(result, '(array with 3 items)');
});
