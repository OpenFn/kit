import test from 'ava';

import tryWithBackoff from '../../src/util/try-with-backoff';

// TODO these unit tests are terrible and don't actually exercise the backoff or timeout interval

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

test('cancel', async (t) => {
  let callCount = 0;

  const fn = () => {
    callCount++;
    throw new Error('test');
  };

  const p = tryWithBackoff(fn);
  p.cancel();

  return p.then(() => {
    // Cancelling won't interrupt the first callback, but it will stop it being called again
    t.is(callCount, 1);
    t.pass();
  });
});

test('cancel nested promise', async (t) => {
  let callCount = 0;

  const fn = () => {
    callCount++;
    if (callCount > 1) {
      p.cancel();
    }
    throw new Error('test');
  };

  const p = tryWithBackoff(fn);

  return p.then(() => {
    t.is(callCount, 2);
    t.pass();
  });
});

// TODO test increasing backoffs
