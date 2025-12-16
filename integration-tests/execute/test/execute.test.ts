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

test.serial('allow export statements and functions', async (t) => {
  const state = {};

  const job = `
    export const x = () => ({ x: 90 })
    fn(() => x())
  `;
  const result = await execute(job, state);

  t.deepEqual(result, { x: 90 });
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

test.serial('catch an error and re-throw it', async (t) => {
  const state = {
    data: {
      x: 22,
    },
  };

  const job = `fn(() => {
    throw new Error('err')
  }).catch(e => { throw e })`;

  const result = await execute(job, state);
  t.is(result.errors.src.name, 'JobError');
  t.is(result.errors.src.message, 'err');
});

test.serial('catch an error and return state', async (t) => {
  const state = {
    data: {
      x: 22,
    },
  };

  const job = `fn(() => {
    throw { err: true }
  }).catch((e, s) => s)`;

  const result = await execute(job, state);
  t.deepEqual(result, state);
});

test.serial('each with then ', async (t) => {
  const state = {
    ids: [1, 2, 3],
    results: [],
  };

  const job = `each($.ids,
      get(\`https://jsonplaceholder.typicode.com/todos/\${$.data}\`).then(
      (s) => {
        s.results.push(s.data);
        return s;
      }
    )
  )`;

  const result = await execute(job, state, 'http');

  t.is(result.results.length, 3);
  t.is(result.results[0].id, 1);
  t.is(result.results[1].id, 2);
  t.is(result.results[2].id, 3);
});
