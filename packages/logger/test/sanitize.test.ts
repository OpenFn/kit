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

test('simply return undefined', (t) => {
  const result = sanitize(undefined);
  t.deepEqual(result, undefined);
});

test('stringify an error', (t) => {
  const e = new Error('test');
  const result = sanitize(e);
  t.regex(result, /test/);
});

test('stringify ReferenceError', (t) => {
  const e = new ReferenceError('test');
  const result = sanitize(e);
  t.regex(result, /ReferenceError/);
});

test('stringify a custom error', (t) => {
  class CustomError extends Error {}
  const e = new CustomError('test');
  const result = sanitize(e);
  t.regex(result, /test/);
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
