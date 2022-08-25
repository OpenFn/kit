import test from 'ava';
import execute from '@openfn/runtime';
import slowmo from '../src/server/jobs/slow-random';

type SlowMoState = {
  data: {
    result: number;
  }
}

const wait = async(time: number) => new Promise(resolve => {
  setTimeout(resolve, time);
});

test('slowmo should return a value', async (t) => {
  const result = await execute(slowmo) as SlowMoState;

  t.assert(result);
  t.assert(result.data.result);
  t.falsy(isNaN(result.data.result))
});

test('slowmo should return after 500ms', async (t) => {
  let result;

  execute(slowmo).then((r)=> {
    result = r;
  });

  // Should not return immediately
  t.falsy(result);

  await wait(100)
  t.falsy(result);

  // Should have returned by now
  await wait(500);
  // @ts-ignore
  t.falsy(isNaN(result.data.result))
});

test('slowmo should accept a delay time as config', async (t) => {
  let result;

  const state = {
    configuration: {
      delay: 10
    },
    data: {}
  };
  execute(slowmo, state).then((r)=> {
    result = r;
  });

  // Should not return immediately
  t.falsy(result);
  
  // Should have data already
  await wait(100)
  // @ts-ignore
  t.falsy(isNaN(result.data.result))
});

test('slowmo should return random numbers', async (t) => {
  const state = {
    configuration: {
      delay: 1
    },
    data: {}
  };
  const a = await execute(slowmo, state)
  const b = await execute(slowmo, state)  
  t.assert(a !== b);
})
