import test from 'ava';

import createThrottler from '../../src/util/queue';

test('invoke a throttled function immediately', (t) => {
  const throttle = createThrottler();

  const fn = async () => {
    t.pass('called the callback');
  };

  const wrapped = throttle(fn);

  wrapped();
});

test('throttled function should return', async (t) => {
  const throttle = createThrottler();

  const fn = async () => 1;

  const wrapped = throttle(fn);

  const result = await wrapped();
  t.is(result, 1);
});

test('throttled function should throw', async (t) => {
  const throttle = createThrottler();

  const fn = async () => {
    throw new Error('e');
  };

  const wrapped = throttle(fn);

  await t.throwsAsync(() => wrapped(), {
    message: 'e',
  });
});

test('throttled function should wait for previous to finish', async (t) => {
  const throttle = createThrottler();

  let times: number[] = [];

  const fn = () =>
    new Promise<void>((resolve) => {
      times.push(Date.now());
      setTimeout(() => resolve(), 20);
    });

  const wrapped = throttle(fn);

  await Promise.all([wrapped(), wrapped()]);

  t.is(times.length, 2);

  let diff = times[1] - times[0];
  t.log(`delay: ${diff}ms`);

  t.true(diff >= 18); // should be 20 but keep it loose
});

test('process of queue of items', async (t) => {
  const throttle = createThrottler();
  let count = 0;

  const fn = () =>
    new Promise<void>((resolve) => {
      setTimeout(() => {
        count++;
        resolve();
      }, 10);
    });

  const a = throttle(fn);
  const b = throttle(fn);
  const c = throttle(fn);

  await Promise.all([a(), b(), c()]);

  t.is(count, 3);
});

test('return in order', async (t) => {
  const throttle = createThrottler();

  const results: string[] = [];

  const fn = (name: string, delay: number) =>
    new Promise<void>((resolve) => {
      setTimeout(() => {
        results.push(name);
        resolve();
      }, Math.random() * 500);
    });

  const wrapped = throttle(fn);

  await Promise.all([
    wrapped('a', 200),
    wrapped('b', 0),
    wrapped('c', 1),
    wrapped('d', 200),
    wrapped('e', 20),
  ]);

  t.deepEqual(results, ['a', 'b', 'c', 'd', 'e']);
});
