import test from 'ava';

import execute from '../src/execute';

const wait = `function wait() {
  return (state) =>
    new Promise((resolve) => {
      setTimeout(() => resolve(state), 2);
    });
};`;

test.serial('should return state', async (t) => {
  const state = { data: { x: 1 } };

  const job = `
    fn(s => s)
  `;
  const result = await execute(job, state);

  t.deepEqual(state, result);
});

test.serial('should use .then()', async (t) => {
  const state = { data: { x: 1 } };

  const job = `
    fn(s => s)
      .then((s) =>
        ({
          data: { x: 33 }
        })
      )
  `;
  const result = await execute(job, state);

  t.deepEqual(result, { data: { x: 33 } });
});

test.serial('should chain .then() with state', async (t) => {
  const state = { data: { x: 1 } };

  const job = `
    fn(s => ({ x: 1 }))
      .then((s) =>
        ({
          x: s.x + 1
        })
      )
  `;
  const result = await execute(job, state);

  t.deepEqual(result, { x: 2 });
});

test.serial('should use .then() as an argument', async (t) => {
  const state = {};

  const job = `fn(
    fn(() => ({ x: 5 })).then((s) => ({ x: s.x + 1}))
  )`;
  const result = await execute(job, state);

  t.deepEqual(result, { x: 6 });
});

test.serial('use then() with wait()', async (t) => {
  const state = {
    data: {
      x: 22,
    },
  };

  const job = `${wait}
  wait().then(fn(s => s))`;

  const result = await execute(job, state);

  t.deepEqual(result.data, { x: 22 });
});

test.serial('catch an error and return it', async (t) => {
  const state = {
    data: {
      x: 22,
    },
  };

  const job = `fn(() => {
    throw { err: true }
  }).catch(e => e)`;

  const result = await execute(job, state);
  t.deepEqual(result, { err: true });
});
