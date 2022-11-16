import test from 'ava';

import sanitize, { SECRET } from '../src/sanitize';

const options = {};
test('simply return a string', (t) => {
  const result = sanitize('x', options);
  t.is(result, 'x');
});

test('simply return an object', (t) => {
  const result = sanitize({ a: 'x' }, options);
  t.deepEqual(result, { a: 'x' });
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
  const result = sanitize(state, options);
  t.deepEqual(result, expectedState);
});

test('sanitize if no data is passed', (t) => {
  const state = {
    configuration: { password: 'password1', username: 'foo' },
  };
  const expectedState = {
    configuration: { password: SECRET, username: SECRET },
  };
  const result = sanitize(state, options);
  t.deepEqual(result, expectedState);
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
  const result = sanitize(state, options);
  t.deepEqual(result, expectedState);
});

// TODO not implemented yet
test.skip('sanitize a simple path', (t) => {
  const result = sanitize({ a: 'x' }, { sanitizePaths: ['a'] });
  t.deepEqual(result, { a: SECRET });
});

test.skip('sanitize state.configuration even if extra args are passed', () => {});

test.skip("don't sanitize nested state-like objects", () => {});

// TODO do some cool jsonpath stuff

// TODO can we sanitize properly inside an each loop?
// The adaptor may have to do some magic

// How doe a job update the list of sensitive paths?

// If I fetch data from the server and want to log each item,
// how do I easily sanitise? Or test?
// I can accept a jsonpath but they're not always easy...

// What if someone wants to override sanitise rules for state.config? Eg to show the user name?
