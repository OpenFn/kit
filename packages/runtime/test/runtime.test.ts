import test from 'ava';
import { fn } from '@openfn/language-common';
import type { State, Operation } from '@openfn/language-common';
import { createMockLogger } from '@openfn/logger';
import run from '../src/runtime';

type TestState = State & {
  data: {
    x: number;
  };
};

const createState = (data = {}) => ({
  data: data,
  configuration: {},
});

// Most of these unit tests pass in live JS code into the job pipeline
// This is convenient in testing as it's easier to catch errors
// Note that the linker and module loader do heavier testing of strings

test('a live no-op job with one operation', async (t) => {
  const job = [(s: State) => s];
  const state = createState();
  const result = await run(job, state);

  t.deepEqual(state, result);
});

test('a stringified no-op job with one operation', async (t) => {
  const job = 'export default [(s) => s]';
  const state = createState();
  const result = await run(job, state);

  t.deepEqual(state, result);
});

test('a live no-op job with @openfn/language-common.fn', async (t) => {
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
      s.data.x = 2;
      return s;
    },
    (s: TestState) => {
      s.data.x += 2;
      return s;
    },
    (s: TestState) => {
      s.data.x *= 3;
      return s;
    },
  ] as Operation[];

  const state = createState();
  // @ts-ignore
  t.falsy(state.data.x);

  const result = (await run(job, state)) as TestState;

  t.is(result.data.x, 12);
});

test('jobs run in series with async operations', async (t) => {
  const job = [
    (s: TestState) => {
      s.data.x = 2;
      return s;
    },
    (s: TestState) =>
      new Promise((resolve) => {
        setTimeout(() => {
          s.data.x += 2;
          resolve(s);
        }, 10);
      }),
    (s: TestState) => {
      s.data.x *= 3;
      return s;
    },
  ] as Operation[];

  const state = createState();
  // @ts-ignore
  t.falsy(state.data.x);

  const result = (await run(job, state)) as TestState;

  t.is(result.data.x, 12);
});

test('jobs do mutate the original state', async (t) => {
  const job = [
    (s: TestState) => {
      s.data.x = 2;
      return s;
    },
  ] as Operation[];

  const state = createState({ x: 1 }) as TestState;
  const result = (await run(job, state, {
    immutableState: false,
  })) as TestState;

  t.is(state.data.x, 2);
  t.is(result.data.x, 2);
});

test('jobs do not mutate the original state', async (t) => {
  const job = [
    (s: TestState) => {
      s.data.x = 2;
      return s;
    },
  ] as Operation[];

  const state = createState({ x: 1 }) as TestState;
  const result = (await run(job, state, { immutableState: true })) as TestState;

  t.is(state.data.x, 1);
  t.is(result.data.x, 2);
});

test('forwards a logger to the console object inside a job', async (t) => {
  const logger = createMockLogger(undefined, { level: 'info' });

  // We must define this job as a module so that it binds to the sandboxed context
  const job = `
export default [
  (s) => { console.log("x"); return s; }
];`;

  const state = createState();
  await run(job, state, { jobLogger: logger });

  const output = logger._parse(logger._last);
  t.is(output.level, 'info');
  t.is(output.message, 'x');
});

test('calls execute if exported from a job', async (t) => {
  const logger = createMockLogger(undefined, { level: 'info' });

  // The execute function, if called by the runtime, will send a specific
  // message to console.log, which we can pick up here in the test
  const source = `
    export const execute = () => { console.log('x'); return () => ({}) };
    export default [];
  `;

  await run(source, { configuration: {}, data: {} }, { jobLogger: logger });

  t.is(logger._history.length, 1);
});

// Skipping for now as the default timeout is quite long
test.skip('Throws after default timeout', async (t) => {
  const logger = createMockLogger(undefined, { level: 'info' });

  const job = `export default [() => new Promise(() => {})];`;

  const state = createState();
  await t.throwsAsync(async () => run(job, state, { jobLogger: logger }), {
    message: 'timeout',
  });
});

test('Throws after custom timeout', async (t) => {
  const logger = createMockLogger(undefined, { level: 'info' });

  const job = `export default [() => new Promise((resolve) => setTimeout(resolve, 100))];`;

  const state = createState();
  await t.throwsAsync(
    async () => run(job, state, { jobLogger: logger, timeout: 10 }),
    {
      message: 'timeout',
    }
  );
});
