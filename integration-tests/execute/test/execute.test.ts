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

// This fails because the compiler can't handle it
test.serial.skip('should use .then()', async (t) => {
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

  t.deepEqual(state, { data: { x: 33 } });
});
