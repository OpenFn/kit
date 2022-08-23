import test from "ava";
import { fn } from '@openfn/language-common';
import type { State, Operation } from '@openfn/language-common';
import run from '../src/runtime';

type TestState = State & {
  data: {
    x: number
  }
};

const createState = (data = {}) => ({
  data: data,
  configuration: {}
});

test('a no-op job with one operation', async (t) => {
  const job = [(s: State) => s];
  const state = createState();
  const result = await run(job, state);

  t.deepEqual(state, result);
});

test('a no-op job with one fn operation', async (t) => {
  const job = [fn((s: State) => s)];
  const state = createState();
  const result = await run(job, state);

  t.deepEqual(state, result);
});

test('jobs can handle a promise', async (t) => {
  const job = [async (s: State) => s];
  const state = createState();
  const result = await run(job, state);

  t.deepEqual(state, result);
});

test('jobs run in series', async (t) => {
  const job = [
    (s: TestState) => {
      s.data.x = 2
      return s;
    },
    (s: TestState) => {
      s.data.x += 2;
      return s;
    },
    (s: TestState) => {
      s.data.x *= 3;
      return s;
    }
  ] as Operation[];

  const state = createState();
  // @ts-ignore
  t.falsy(state.data.x);

  const result = await run(job, state) as TestState;

  t.is(result.data.x, 12);
})

test('jobs run in series with async operations', async (t) => {
  const job = [
    (s: TestState) => {
      s.data.x = 2
      return s;
    },
    (s: TestState) => new Promise(resolve => {
      setTimeout(() => {
        s.data.x += 2;
        resolve(s)
      }, 10);
    }),
    (s: TestState) => {
      s.data.x *= 3;
      return s;
    }
  ] as Operation[];

  const state = createState();
  // @ts-ignore
  t.falsy(state.data.x);

  const result = await run(job, state) as TestState;

  t.is(result.data.x, 12);
})


test('jobs do not mutate the original state', async (t) => {
  const job = [(s: TestState) => {
    s.data.x = 2;
    return s;
  }] as Operation[];

  const state = createState({ x: 1 }) as TestState;
  const result = await run(job, state) as TestState;

  t.is(state.data.x, 1);
  t.is(result.data.x, 2);
})

// test('override console.log', async (t) => {
//   const log: string[] = [];
//   const logger = {
//     log(message: string) {
//       log.push(message);
//     }
//   };

//   const job = [(s) => {
//     console.log("x");
//     return s;
//   }]

//   const state = createState();
//   const result = await run(job, state, { logger })

//   t.deepEqual(log, ["x"]);
// });