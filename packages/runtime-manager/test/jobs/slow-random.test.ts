import test from 'ava';
import execute from '@openfn/runtime';
import compile from '@openfn/compiler';

type SlowMoState = {
  data: {
    result: number;
  };
};

const wait = async (time: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, time);
  });

const compiledJob = compile('src/server/jobs/slow-random.js');
test('slowmo should return a value', async (t) => {
  const result = (await execute(compiledJob)) as SlowMoState;

  t.assert(result);
  t.assert(result.data.result);
  t.falsy(isNaN(result.data.result));
});

test('slowmo should return after 500ms', async (t) => {
  let result;

  execute(compiledJob).then((r) => {
    result = r;
  });

  // Should not return immediately
  t.falsy(result);

  await wait(100);
  t.falsy(result);

  // Should have returned by now
  await wait(500);
  // @ts-ignore
  t.falsy(isNaN(result.data.result));
});

test('slowmo should accept a delay time as config', async (t) => {
  let result;

  const state = {
    configuration: {
      delay: 10,
    },
    data: {},
  };
  execute(compiledJob, state).then((r) => {
    result = r;
  });

  // Should not return immediately
  t.falsy(result);

  // Should have data already
  await wait(100);
  // @ts-ignore
  t.falsy(isNaN(result.data.result));
});

test('slowmo should return random numbers', async (t) => {
  const state = {
    configuration: {
      delay: 1,
    },
    data: {},
  };
  const a = await execute(compiledJob, state);
  const b = await execute(compiledJob, state);
  t.assert(a !== b);
});
