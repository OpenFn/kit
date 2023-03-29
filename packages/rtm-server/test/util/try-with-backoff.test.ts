import test from 'ava';

import { tryWithBackoff } from '../../src/util';

test('return immediately', async (t) => {
  let callCount = 0;
  const fn = async () => {
    callCount++;
  };

  await tryWithBackoff(fn);
  t.is(callCount, 1);
});

test('return on second try', async (t) => {
  let callCount = 0;
  const fn = () => {
    callCount++;
    if (callCount <= 1) {
      throw new Error('test');
    }
  };

  await tryWithBackoff(fn);

  t.is(callCount, 2);
});

test.skip('return on tenth try (maximum backoff)', () => {});

test('throw if maximum attempts (1) reached', async (t) => {
  let callCount = 0;
  const fn = async () => {
    callCount++;
    throw new Error('test');
  };

  await t.throwsAsync(() => tryWithBackoff(fn, { maxAttempts: 1 }), {
    message: 'max attempts exceeded',
  });
  t.is(callCount, 1);
});

test('throw if maximum attempts (5) reached', async (t) => {
  let callCount = 0;
  const fn = async () => {
    callCount++;
    throw new Error('test');
  };

  await t.throwsAsync(() => tryWithBackoff(fn, { maxAttempts: 5 }), {
    message: 'max attempts exceeded',
  });
  t.is(callCount, 5);
});

// TODO allow to be cancelled
// TODO test increasing backoffs
