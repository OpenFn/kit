import test from 'ava';
import { defer } from '../src/runtime-helpers';

test('defer does not execute immediately', (t) => {
  let x = 0;

  const op = () => x++;

  defer(op);

  t.is(x, 0);
});

test('defer: function executes when called', async (t) => {
  let x = 0;

  const op = () => x++;

  const fn = defer(op);

  await fn({});

  t.is(x, 1);
});

test('defer: function executes an async function when called', async (t) => {
  const op = () =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(22);
      }, 2);
    });

  const fn = defer(op);

  const result = await fn({});

  t.is(result, 22);
});

test('defer: returns a value', async (t) => {
  const op = (s) => s * s;

  const fn = defer(op);

  const result = await fn(5);

  t.is(result, 25);
});

test('defer: invoke the complete callback and pass state', async (t) => {
  const op = (s) => ++s;

  const fn = defer(op, (p) => p.then((s) => (s *= 2)));

  const result = await fn(2);

  t.is(result, 6);
});

test('defer: catch an error', async (t) => {
  const op = () => {
    throw 'lamine yamal';
  };

  const c = (e: any, s: any) => {
    t.truthy(e);
    t.truthy(s);
  };

  const fn = defer(op, undefined, c);

  await fn(1);
});

test('defer: catch an async error', async (t) => {
  const op = () =>
    new Promise((_resolve, reject) => {
      setTimeout(() => {
        // This should be handled gracefully
        reject('lamine yamal');

        // but this will be uncaught!
        // I don't think there's anything we can do about this tbh
        //throw 'lamine yamal';
      }, 2);
    });

  const c = (e: any, s: any) => {
    t.is(e, 'lamine yamal');
    t.truthy(s);
  };

  const fn = defer(op, undefined, c);

  await fn(1);
});
