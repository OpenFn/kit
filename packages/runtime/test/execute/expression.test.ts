import test from 'ava';
import { fn } from '@openfn/language-common';
import type { State, Operation, ExecutionContext } from '../../src/types';
import { createMockLogger } from '@openfn/logger';
import execute from '../../src/execute/expression';

type TestState = State & {
  data: {
    x: number;
  };
};

const createState = (data = {}) => ({
  data: data,
  configuration: {},
});

const logger = createMockLogger(undefined, { level: 'debug' });

const createContext = (args = {}) =>
  ({
    logger,
    plan: {},
    opts: {},
    notify: () => {},
    report: () => {},
    ...args,
  } as unknown as ExecutionContext);

test.afterEach(() => {
  logger._reset();
});

// Most of these unit tests pass in live JS code into the job pipeline
// This is convenient in testing as it's easier to catch errors
// Note that the linker and module loader do heavier testing of strings

test('run a live no-op job with one operation', async (t) => {
  const job = [(s: State) => s];
  const state = createState();

  const context = createContext();

  const result = await execute(context, job, state);

  t.deepEqual(state, result);
});

test('run a stringified no-op job with one operation', async (t) => {
  const job = 'export default [(s) => s]';
  const state = createState();
  const context = createContext();

  const result = await execute(context, job, state);

  t.deepEqual(state, result);
});

test('run a live no-op job with @openfn/language-common.fn', async (t) => {
  const job = [fn((s) => s)];
  const state = createState();
  const context = createContext();

  const result = await execute(context, job, state);

  t.deepEqual(state, result);
});

test('notify job-start', async (t) => {
  let didCallCallback = false;

  const expression = [(s: State) => s];
  const state = createState();

  const notify = (event: string, payload?: any) => {
    if (event === 'job-start') {
      didCallCallback = true;
    }
    t.is(payload.jobId, 'j');
  };

  const context = createContext({ notify });

  await execute(context, expression, state, 'j');
  t.true(didCallCallback);
});

test('notifu job-complete', async (t) => {
  let didCallCallback = false;

  const expression = [(s: State) => s];
  const state = createState();

  const notify = (event: string, payload: any) => {
    if (event === 'job-complete') {
      const { state, duration, jobId } = payload;
      didCallCallback = true;
      t.truthy(state);
      t.assert(!isNaN(duration));
      t.is(jobId, 'j');
    }
  };

  const context = createContext({ notify });

  await execute(context, expression, state, 'j');
  t.true(didCallCallback);
});

test('jobs can handle a promise', async (t) => {
  const job = [async (s: State) => s];
  const state = createState();
  const context = createContext();

  const result = await execute(context, job, state);

  t.deepEqual(state, result);
});

test('output state should be serializable', async (t) => {
  const job = [async (s: State) => s];

  const circular = {};
  circular.self = circular;

  const state = createState({
    circular,
    fn: () => {},
  });

  const context = createContext();

  const result = await execute(context, job, state);

  t.notThrows(() => JSON.stringify(result));

  t.is(result.data.circular.self, '[Circular]');
  t.falsy(result.data.fn);
});

test('config is removed from the result (strict)', async (t) => {
  const job = [async (s: State) => s];
  const context = createContext({ opts: { strict: true } });

  const result = await execute(context, job, { configuration: {} });
  t.deepEqual(result, {});
});

test('config is removed from the result (non-strict)', async (t) => {
  const job = [async (s: State) => s];
  const context = createContext({ opts: { strict: false } });
  const result = await execute(context, job, { configuration: {} });
  t.deepEqual(result, {});
});

test('output state is cleaned in strict mode', async (t) => {
  const job = [
    async () => ({
      data: {},
      references: [],
      configuration: {},
      x: true,
    }),
  ];

  const context = createContext({ opts: { strict: true } });

  const result = await execute(context, job, {});
  t.deepEqual(result, {
    data: {},
    references: [],
  });
});

test('output state is left alone in non-strict mode', async (t) => {
  const state = {
    data: {},
    references: [],
    configuration: {},
    x: true,
  };
  const job = [async () => ({ ...state })];

  const context = createContext({ opts: { strict: false } });

  const result = await execute(context, job, {});
  t.deepEqual(result, {
    data: {},
    references: [],
    x: true,
  });
});

test('operations run in series', async (t) => {
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

  const context = createContext();
  const state = createState();
  // @ts-ignore
  t.falsy(state.data.x);

  const result = (await execute(context, job, state)) as TestState;

  t.is(result.data.x, 12);
});

test('async operations run in series', async (t) => {
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
  const context = createContext();

  // @ts-ignore
  t.falsy(state.data.x);

  const result = (await execute(context, job, state)) as TestState;

  t.is(result.data.x, 12);
});

test('jobs can return undefined', async (t) => {
  // @ts-ignore violating the operation contract here
  const job = [() => undefined] as Operation[];

  const state = createState() as TestState;
  const context = createContext();

  const result = (await execute(context, job, state, {})) as TestState;

  t.assert(result === undefined);
});

test('jobs can mutate the original state', async (t) => {
  const job = [
    (s: TestState) => {
      s.data.x = 2;
      return s;
    },
  ] as Operation[];

  const state = createState({ x: 1 }) as TestState;
  const context = createContext({ opts: { immutableState: false } });
  const result = (await execute(context, job, state)) as TestState;

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
  const context = createContext({ opts: { immutableState: true } });
  const result = (await execute(context, job, state)) as TestState;

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
  const context = createContext({ opts: { jobLogger: logger } });
  await execute(context, job, state);

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
  const context = createContext({ opts: { jobLogger: logger } });
  await execute(context, source, { configuration: {}, data: {} });

  t.is(logger._history.length, 1);
});

// Skipping for now as the default timeout is quite long
test.skip('Throws after default timeout', async (t) => {
  const logger = createMockLogger(undefined, { level: 'info' });

  const job = `export default [() => new Promise(() => {})];`;

  const state = createState();
  const context = createContext({ opts: { jobLogger: logger } });
  await t.throwsAsync(async () => execute(context, job, state), {
    message: 'timeout',
  });
});

test('Throws after custom timeout', async (t) => {
  const logger = createMockLogger(undefined, { level: 'info' });

  const job = `export default [() => new Promise((resolve) => setTimeout(resolve, 100))];`;

  const context = createContext({
    opts: { jobLogger: logger, timeout: 10 },
  });
  const state = createState();
  await t.throwsAsync(async () => execute(context, job, state), {
    message: 'Job took longer than 10ms to complete',
    name: 'TimeoutError',
  });
});

test('Operations log on start and end', async (t) => {
  const job = [(s: State) => s];
  const state = createState();
  const context = createContext();
  await execute(context, job, state);

  const start = logger._find('debug', /starting operation /i);
  t.truthy(start);

  const end = logger._find('info', /operation 1 complete in \dms/i);
  t.truthy(end);
});
