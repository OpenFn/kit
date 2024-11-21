import test from 'ava';
import { fn } from '@openfn/language-common';
import { createMockLogger } from '@openfn/logger';
import type { Operation, State } from '@openfn/lexicon';

import execute, { mergeLinkerOptions } from '../../src/execute/expression';
import type { ExecutionContext } from '../../src/types';

type TestState = State & {
  data: {
    x: number;
  };
};

const createState = (data = {}) => ({
  data,
  configuration: {},
});

const logger = createMockLogger(undefined, { level: 'debug' });

const createContext = (args = {}, options = {}) =>
  // @ts-ignore
  ({
    logger,
    plan: {},
    opts: {
      ...options,
    },
    notify: () => {},
    report: () => {},
    ...args,
  } as ExecutionContext);

test.afterEach(() => {
  logger._reset();
});

// Most of these unit tests pass in live JS code into the job pipeline
// This is convenient in testing as it's easier to catch errors
// Note that the linker and module loader do heavier testing of strings

test.serial('run a live no-op job with one operation', async (t) => {
  const job = [(s: State) => s];
  const state = createState();
  const context = createContext();

  const result = await execute(context, job, state);

  t.deepEqual(state, result);
});

test.serial('run a stringified no-op job with one operation', async (t) => {
  const job = 'export default [(s) => s]';
  const state = createState();
  const context = createContext();

  const result = await execute(context, job, state);

  t.deepEqual(state, result);
});

test.serial(
  'run a live no-op job with @openfn/language-common.fn',
  async (t) => {
    const job = [fn((s) => s)];
    const state = createState();
    const context = createContext();

    const result = await execute(context, job, state);

    t.deepEqual(state, result);
  }
);

test.serial('jobs can handle a promise', async (t) => {
  const job = [async (s: State) => s];
  const state = createState();
  const context = createContext();

  const result = await execute(context, job, state);

  t.deepEqual(state, result);
});

test.serial('operations run in series', async (t) => {
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

test.serial('async operations run in series', async (t) => {
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

test.serial('jobs can return undefined', async (t) => {
  // @ts-ignore violating the operation contract here
  const job = [() => undefined] as Operation[];

  const state = createState() as TestState;
  const context = createContext();

  const result = (await execute(context, job, state, {})) as TestState;

  t.assert(result === undefined);
});

test.serial('jobs can mutate the original state', async (t) => {
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

test.serial('jobs do not mutate the original state', async (t) => {
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

test.serial(
  'forwards a logger to the console object inside a job',
  async (t) => {
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
  }
);

test.serial('calls execute if exported from a job', async (t) => {
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

test.serial('handles a promise returned by an operation', async (t) => {
  const logger = createMockLogger(undefined, { level: 'info' });

  const job = `export default [
    (s) =>  new Promise((r) => r(s))
  ];`;

  const state = createState({ x: 1 });
  const context = createContext({ opts: { jobLogger: logger } });

  const result = (await execute(context, job, state)) as TestState;

  t.is(result.data.x, 1);
});

test.serial(
  'handles a promise returned by an operation with .then()',
  async (t) => {
    const logger = createMockLogger(undefined, { level: 'info' });

    const job = `export default [
    (s) => 
      new Promise((r) => r(s))
        .then(s => ({ data: { x: 2 }}))
  ];`;

    const state = createState({ x: 1 });
    const context = createContext({ opts: { jobLogger: logger } });

    const result = (await execute(context, job, state)) as TestState;

    t.is(result.data.x, 2);
  }
);

test.serial(
  'handles a promise returned by an operation with .catch()',
  async (t) => {
    const logger = createMockLogger(undefined, { level: 'info' });

    const job = `export default [
    (s) => 
      new Promise((r) => { throw "err" })
        .catch((e) => ({ data: { x: 3 }}))
  ];`;

    const state = createState({ x: 1 });
    const context = createContext({ opts: { jobLogger: logger } });

    const result = (await execute(context, job, state)) as TestState;

    t.is(result.data.x, 3);
  }
);

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

test.serial('Throws after custom timeout', async (t) => {
  const logger = createMockLogger(undefined, { level: 'info' });

  const job = `export default [() => new Promise((resolve) => setTimeout(resolve, 100))];`;

  const context = createContext({
    plan: { options: { timeout: 10 } },
    opts: { jobLogger: logger },
  });
  const state = createState();
  await t.throwsAsync(async () => execute(context, job, state), {
    message: 'Job took longer than 10ms to complete',
    name: 'TimeoutError',
  });
});

test.serial('Operations log on start and end', async (t) => {
  const job = [(s: State) => s];
  const state = createState();
  const context = createContext();
  await execute(context, job, state);
  const start = logger._find('debug', /starting operation /i);
  t.truthy(start);

  const end = logger._find('debug', /operation 1 complete in \dms/i);
  t.truthy(end);
});

test.serial('mergeLinkerOptions: use linker options only', (t) => {
  const map = {
    x: {
      path: 'a/b/c',
      version: '1.0.0',
    },
  };
  const result = mergeLinkerOptions(map);
  t.deepEqual(result, map);
});

test.serial('mergeLinkerOptions: use override options only', (t) => {
  const map = {
    x: {
      path: 'a/b/c',
      version: '1.0.0',
    },
  };
  const result = mergeLinkerOptions(undefined, map);
  t.deepEqual(result, map);
});

test.serial('mergeLinkerOptions: override path and value', (t) => {
  const options = {
    x: {
      path: 'a/b/c',
      version: '1.0.0',
    },
  };
  const override = {
    x: {
      path: 'x/y/z',
      version: '2.0.0',
    },
  };
  const result = mergeLinkerOptions(options, override);
  t.deepEqual(result, override);
});

test.serial('mergeLinkerOptions: override path only', (t) => {
  const options = {
    x: {
      path: 'a/b/c',
      version: '1.0.0',
    },
  };
  const override = {
    x: {
      path: 'x/y/z',
    },
  };
  const result = mergeLinkerOptions(options, override);
  t.deepEqual(result, {
    x: {
      path: 'x/y/z',
      version: '1.0.0',
    },
  });
});

test.serial('mergeLinkerOptions: override version only', (t) => {
  const options = {
    x: {
      path: 'a/b/c',
      version: '1.0.0',
    },
  };
  const override = {
    x: {
      version: '2.0.0',
    },
  };
  const result = mergeLinkerOptions(options, override);
  t.deepEqual(result, {
    x: {
      path: 'a/b/c',
      version: '2.0.0',
    },
  });
});

test.serial('mergeLinkerOptions: merge multiple adaptors', (t) => {
  const options = {
    x: {
      path: 'a/b/c',
      version: '1.0.0',
    },
  };
  const override = {
    y: {
      path: 'x/y/z',
      version: '2.0.0',
    },
  };
  const result = mergeLinkerOptions(options, override);
  t.deepEqual(result, {
    ...options,
    ...override,
  });
});
