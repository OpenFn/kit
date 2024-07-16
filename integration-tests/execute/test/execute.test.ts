import test from 'ava';

import execute from '../src/execute';

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
