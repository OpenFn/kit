import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';
import type { ExecutionPlan, Job } from '@openfn/lexicon';

import execute from './../../src/execute/plan';
import { CompiledExecutionPlan } from '../../src';

let mockLogger = createMockLogger(undefined, { level: 'debug' });

const createPlan = (
  jobs: Job[],
  options: Partial<CompiledExecutionPlan['options']> = {}
): ExecutionPlan => ({
  workflow: {
    jobs,
  },
  options,
});

const createJob = ({ id, expression, next, state }: any): Job => ({
  id: id ?? 'job1',
  expression: expression ?? 'export default [s => s]',
  state,
  next,
});

test('throw for a circular job', async (t) => {
  const plan = createPlan([
    createJob({ next: { job2: true } }),
    createJob({ id: 'job2', next: { job1: true } }),
  ]);
  const e = await t.throwsAsync(() => execute(plan, {}, mockLogger));
  t.regex(e!.message, /circular dependency/i);
});

test('throw for a job with multiple inputs', async (t) => {
  const plan = createPlan([
    createJob({ next: { job3: true } }),
    createJob({ id: 'job2', next: { job3: true } }),
    createJob({ id: 'job3' }),
  ]);

  const e = await t.throwsAsync(() => execute(plan, {}, mockLogger));
  t.regex(e!.message, /multiple dependencies/i);
});

test('throw for a plan which references an undefined job', async (t) => {
  const plan = createPlan([createJob({ next: { job3: true } })]);

  const e = await t.throwsAsync(() => execute(plan, {}, mockLogger));
  t.regex(e!.message, /cannot find job/i);
});

test('throw for an illegal edge condition', async (t) => {
  const plan = createPlan([
    createJob({
      next: {
        job2: {
          condition: '!!!',
        },
      },
    }),
    createJob({ id: 'job2' }),
  ]);
  const e = await t.throwsAsync(() => execute(plan, {}, mockLogger));
  t.regex(e!.message, /failed to compile edge condition job1->job2/i);
});

test('execute a one-job execution plan with inline state', async (t) => {
  const plan = createPlan([
    createJob({
      expression: 'export default [s => s.data.x]',
      state: { data: { x: 22 } },
    }),
  ]);
  const result = (await execute(plan, {}, mockLogger)) as unknown as number;
  t.is(result, 22);
});

test('execute a one-job execution plan with initial state', async (t) => {
  const plan = createPlan(
    [
      createJob({
        expression: 'export default [s => s.data.x]',
      }),
    ],
    {
      initialState: {
        data: { x: 33 },
      },
    }
  );
  const result = (await execute(plan, {}, mockLogger)) as unknown as number;
  t.is(result, 33);
});

test('lazy load initial state', async (t) => {
  const plan = createPlan(
    [
      createJob({
        expression: 'export default [s => s]',
      }),
    ],
    {
      // @ts-ignore TODO tidy this up
      initialState: 's1',
    }
  );

  const states = { s1: { data: { result: 42 } } };
  const options = {
    callbacks: {
      resolveState: (id: string) => states[id],
    },
  };

  const result = await execute(plan, options, mockLogger);
  t.deepEqual(result, states.s1);
});

test('execute a one-job execution plan and notify init-start and init-complete', async (t) => {
  let notifications: Record<string, any> = {};

  const state = {
    data: { x: 33 },
  };

  const plan = createPlan(
    [
      createJob({
        expression: 'export default [s => s.data.x]',
      }),
    ],
    {
      initialState: state,
    }
  );

  const notify = (event: string, payload: any) => {
    if (notifications[event]) {
      throw new Error(`event ${event} called twice!`);
    }
    notifications[event] = payload || true;
  };

  const options = { callbacks: { notify } };

  await execute(plan, options, mockLogger);

  t.truthy(notifications['init-start']);
  t.truthy(notifications['init-complete']);
  t.assert(!isNaN(notifications['init-complete'].duration));
});

test('execute a job with a simple truthy "precondition" or "trigger node"', async (t) => {
  const plan = createPlan([
    createJob({
      next: {
        job: {
          condition: 'true',
        },
      },
    }),
    createJob({
      id: 'job',
      expression: 'export default [() => ({ data: { done: true } })]',
    }),
  ]);

  const result = await execute(plan, {}, mockLogger);
  t.true(result.data.done);
});

test('do not execute a job with a simple falsy "precondition" or "trigger node"', async (t) => {
  const plan = createPlan([
    createJob({
      next: {
        job: {
          condition: 'false',
        },
      },
    }),
    createJob({
      id: 'job',
      expression: 'export default [() => ({ data: { done: true } })]',
    }),
  ]);

  const result = await execute(plan, {}, mockLogger);
  t.falsy(result.data.done);
});

test('execute a job with a valid "precondition" or "trigger node"', async (t) => {
  const plan = createPlan(
    [
      // @ts-ignore TODO make this a trigger node when we have the types
      {
        id: 'a',
        next: {
          job: {
            condition: 'true',
          },
        },
      },
      createJob({
        id: 'job',
        expression: 'export default [() => ({ data: { done: true } })]',
      }),
    ],
    {
      initialState: { data: { x: 10 } },
    }
  );

  const result = await execute(plan, {}, mockLogger);
  t.true(result.data.done);
});

test('merge initial and inline state', async (t) => {
  const plan = createPlan(
    [
      createJob({
        expression: 'export default [s => s]',
        state: { data: { y: 11 } },
      }),
    ],
    {
      initialState: { data: { x: 33 } },
    }
  );

  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.x, 33);
  t.is(result.data.y, 11);
});

test('Initial state overrides inline data', async (t) => {
  const plan = createPlan(
    [
      createJob({
        expression: 'export default [s => s]',
        state: { data: { y: 11 } },
      }),
    ],
    {
      initialState: { data: { x: 34 } },
    }
  );

  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.x, 34);
});

test('Previous state overrides inline data', async (t) => {
  const plan = createPlan([
    // This will return x as 5
    createJob({
      state: { data: { x: 5 } },
      next: {
        job2: true,
      },
    }),
    // This will receive x as 5, prefer it to the default x as 88, and return it plus 1
    createJob({
      id: 'job2',
      expression: 'export default [s => { s.data.x +=1 ; return s; }]',
      state: { data: { x: 88 } },
    }),
  ]);

  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.x, 6);
});

test('only allowed state is passed through in strict mode', async (t) => {
  const plan = createPlan([
    createJob({
      expression:
        'export default [s => ({ data: {}, references: [], x: 22, y: 33 })]',
      next: {
        job2: true,
      },
    }),
    createJob({
      id: 'job2',
      // Throw if we receive unexpected stuff in state
      expression:
        'export default [s => { if (s.x || s.y) { throw new Error() }; return s;}]',
    }),
  ]);

  const result = await execute(plan, { strict: true }, mockLogger);
  t.deepEqual(result, {
    data: {},
    references: [],
  });
});

test('Jobs only receive state from upstream jobs', async (t) => {
  const assert = (expr: string) =>
    `if (!(${expr})) throw new Error('ASSERT FAIL')`;

  const plan = createPlan([
    {
      id: 'start',
      expression: 'export default [s => s]',
      state: { data: { x: 1, y: 1 } },
      next: {
        'x-a': true,
        'y-a': true,
      },
    },

    {
      id: 'x-a',
      expression: `export default [s => {
        ${assert('s.data.x === 1')};
        ${assert('s.data.y === 1')};
        s.data.x += 1;
        return s;
      }]`,
      next: { 'x-b': true },
    },
    {
      id: 'x-b',
      expression: `export default [s => {
        ${assert('s.data.x === 2')};
        ${assert('s.data.y === 1')};
        return s;
      }]`,
    },

    {
      id: 'y-a',
      expression: `export default [s => {
        ${assert('s.data.x === 1')};
        ${assert('s.data.y === 1')};
        s.data.y += 1;
        return s;
      }]`,
      next: { 'y-b': true },
    },
    {
      id: 'y-b',
      expression: `export default [s => {
        ${assert('s.data.x === 1')};
        ${assert('s.data.y === 2')};
        return s;
      }]`,
    },
  ]);

  const result = await execute(plan, {}, mockLogger);

  // explicit check that no assertion failed and wrote an error to state
  t.falsy(result.error);

  // Check there are two results
  t.deepEqual(result, {
    'x-b': { data: { x: 2, y: 1 } },
    'y-b': { data: { x: 1, y: 2 } },
  });
});

test('all state is passed through in non-strict mode', async (t) => {
  const plan = createPlan([
    createJob({
      expression:
        'export default [s => ({ data: {}, references: [], x: 22, y: 33 })]',
      next: {
        job2: true,
      },
    }),
    createJob({
      id: 'job2',
      // Throw if we receive unexpected stuff in state
      expression:
        'export default [s => { if (!s.x || !s.y || !s.references) { throw new Error() }; return s;}]',
    }),
  ]);

  const result = await execute(plan, { strict: false }, mockLogger);
  t.deepEqual(result, {
    data: {},
    references: [],
    x: 22,
    y: 33,
  });
});

test('execute edge based on state in the condition', async (t) => {
  const plan = createPlan([
    {
      id: 'job1',
      state: {},
      expression: 'export default [(s) => { s.data.x = 10; return s;}]',
      next: {
        job2: { condition: 'state.data.x === 10' },
      },
    },
    {
      id: 'job2',
      expression: 'export default [() => ({ data: { y: 20 } })]',
    },
  ]);
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data?.y, 20);
});

test('skip edge based on state in the condition ', async (t) => {
  const plan = createPlan([
    {
      id: 'job1',
      state: {},
      expression: 'export default [s => { s.data.x = 10; return s;}]',
      next: {
        job2: { condition: 'false' },
      },
    },
    {
      id: 'job2',
      expression: 'export default [() => ({ y: 20 })]',
    },
  ]);
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data?.x, 10);
});

test('do not traverse a disabled edge', async (t) => {
  const plan = createPlan([
    {
      id: 'job1',
      expression: 'export default [(s) => { s.data.x = 10; return s;}]',
      next: {
        job2: {
          disabled: true,
          condition: 'true',
        },
      },
    },
    {
      id: 'job2',
      expression: 'export default [() => ({ data: { x: 20 } })]',
    },
  ]);
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data?.x, 10);
});

test('execute a two-job execution plan', async (t) => {
  const plan = createPlan(
    [
      {
        id: 'job1',
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
        next: { job2: true },
      },
      {
        id: 'job2',
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
    ],
    { initialState: { data: { x: 0 } } }
  );

  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.x, 2);
});

test('only execute one job in a two-job execution plan', async (t) => {
  const plan = createPlan(
    [
      {
        id: 'job1',
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
        next: { job2: false },
      },
      {
        id: 'job2',
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
    ],
    { initialState: { data: { x: 0 } } }
  );

  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.x, 1);
});

test('execute a two-job execution plan with custom start', async (t) => {
  const plan = createPlan(
    [
      {
        id: 'job1',
        expression: 'export default [() => ({ data: { result: 11 } }) ]',
      },
      {
        id: 'job2',
        expression: 'export default [() => ({ data: { result: 1 } }) ]',
        next: { job1: true },
      },
    ],
    { start: 'job2' }
  );

  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.result, 11);
});

test('Return when there are no more edges', async (t) => {
  const plan = createPlan(
    [
      {
        id: 'job1',
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
      {
        id: 'job2',
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
    ],
    { start: 'job1', initialState: { data: { x: 0 } } }
  );

  const result = await execute(plan, {}, mockLogger);
  t.is(result.data?.x, 1);
});

test('execute a 5 job execution plan', async (t) => {
  const jobs = [];
  for (let i = 1; i < 6; i++) {
    jobs.push({
      id: `${i}`,
      expression: 'export default [s => { s.data.x += 1; return s; } ]',
      next: i === 5 ? null : { [`${i + 1}`]: true },
    } as Job);
  }

  const plan = createPlan(jobs, {
    initialState: { data: { x: 0 } },
    start: '1',
  });

  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.x, 5);
});

test('execute multiple steps in "parallel"', async (t) => {
  const plan = createPlan(
    [
      {
        id: 'start',
        expression: 'export default [s => s]',
        next: {
          a: true,
          b: true,
          c: true,
        },
      },
      {
        id: 'a',
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
      {
        id: 'b',
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
      {
        id: 'c',
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
    ],
    { start: 'start', initialState: { data: { x: 0 } } }
  );

  const result = await execute(plan, {}, mockLogger);
  t.deepEqual(result, {
    a: { data: { x: 1 } },
    b: { data: { x: 1 } },
    c: { data: { x: 1 } },
  });
});

test('isolate state in "parallel" execution', async (t) => {
  const plan = createPlan(
    [
      {
        id: 'start',
        expression: 'export default [s => s]',
        next: {
          b: true,
          c: true,
        },
      },
      {
        id: 'b',
        expression:
          'export default [s => { if (s.data.c) { throw "e" }; s.data.b = true; return s }]',
      },
      {
        id: 'c',
        expression:
          'export default [s => { if (s.data.b) { throw "e" }; s.data.c = true; return s }]',
      },
    ],
    { start: 'start', initialState: { data: { x: 0 } } }
  );

  const result = await execute(plan, {}, mockLogger);
  t.falsy(result.errors);
});

test('isolate state in "parallel" execution with deeper trees', async (t) => {
  const plan = createPlan(
    [
      {
        id: 'start',
        expression: 'export default [s => s]',
        next: {
          // fudge the order a bit
          c: true,
          b: true,
        },
      },
      {
        id: 'c2',
        expression:
          'export default [s => { if (s.data.b) { throw "e" }; s.data.c = true; return s }]',
      },
      {
        id: 'b',
        expression:
          'export default [s => { if (s.data.c) { throw "e" }; s.data.b = true; return s }]',
        next: { b2: true },
      },
      {
        id: 'c',
        expression:
          'export default [s => { if (s.data.b) { throw "e" }; s.data.c = true; return s }]',
        next: { c2: true },
      },
      {
        id: 'b2',
        expression:
          'export default [s => { if (s.data.c) { throw "e" }; s.data.b = true; return s }]',
      },
    ],
    { start: 'start', initialState: { data: { x: 0 } } }
  );

  const result = await execute(plan, {}, mockLogger);
  t.falsy(result.errors);
});

test('"parallel" execution with multiple leaves should write multiple results to state', async (t) => {
  const plan = createPlan([
    {
      id: 'start',
      expression: 'export default [s => s]',
      next: {
        'job-b': true,
        'job-c': true,
      },
    },
    {
      id: 'job-b',
      expression: 'export default [s => { s.data.b = true; return s }]',
    },
    {
      id: 'job-c',
      expression: 'export default [s => { s.data.c = true; return s }]',
    },
  ]);

  const result = await execute(plan, {}, mockLogger);
  // Each leaf should write to its own place on state
  t.deepEqual(result, {
    'job-b': {
      data: {
        b: true,
      },
    },
    'job-c': {
      data: {
        c: true,
      },
    },
  });
});

test('return an error in state', async (t) => {
  const plan = createPlan([
    {
      id: 'a',
      state: {},
      expression: 'export default [s => { throw Error("e")}]',
    },
  ]);

  const result = await execute(plan, {}, mockLogger);
  t.truthy(result.errors);
  t.is(result.errors.a.message, 'e');
});

// Fix for https://github.com/OpenFn/kit/issues/317
test('handle non-standard error objects', async (t) => {
  const plan = createPlan([
    {
      id: 'a',
      state: {},
      expression: 'export default [s => { throw "wibble" }]',
    },
  ]);

  const result = await execute(plan, {}, mockLogger);
  t.truthy(result.errors);
  const err = result.errors.a;
  t.is(err.type, 'JobError');
  t.is(err.message, 'wibble');
});

test('keep executing after an error', async (t) => {
  const plan = createPlan([
    {
      id: 'a',
      state: {},
      expression: 'export default [s => { throw Error("e"); state.x = 20 }]',
      next: {
        b: true,
      },
    },
    {
      id: 'b',
      expression: 'export default [() => ({ y: 20 })]',
    },
  ]);

  const result = await execute(plan, {}, mockLogger);
  t.is(result.y, 20);
  t.falsy(result.x);
});

test('simple on-error handler', async (t) => {
  const plan = createPlan([
    {
      id: 'job1',
      state: {},
      expression: 'export default [s => { throw Error("e")}]',
      next: {
        job2: { condition: 'state.errors' },
        job3: { condition: '!state.errors' },
      },
    },
    {
      id: 'job2',
      expression: 'export default [() => ({ y: 20 })]',
    },
    {
      id: 'job3',
      expression: 'export default [() => ({ x: 20 })]',
    },
  ]);

  const result = await execute(plan, {}, mockLogger);
  t.is(result.y, 20);
  t.falsy(result.x);
});

test('log appopriately on error', async (t) => {
  const plan = createPlan([
    {
      id: 'job1',
      state: {},
      expression: 'export default [s => { throw Error("e")}]',
    },
  ]);

  const logger = createMockLogger(undefined, { level: 'debug' });

  await execute(plan, {}, logger);
  const err = logger._find('error', /failed job/i);
  t.truthy(err);
  t.regex(err!.message as string, /Failed job job1 after \d+ms/i);

  t.truthy(logger._find('error', /JobError: e/));
  t.truthy(logger._find('error', /Check state.errors.job1 for details/i));
});

test('jobs do not share a local scope', async (t) => {
  const plan = createPlan(
    [
      {
        id: 'job1',
        // declare x in this expression's scope
        expression: 'const x = 10; export default [s => s];',
        next: {
          b: true,
        },
      },
      {
        id: 'b',
        // x should not defined here and this will throw
        expression: 'export default [s => { s.data.x = x; return s; }]',
      },
    ],
    { initialState: { data: {} } }
  );
  await t.throwsAsync(() => execute(plan, {}, mockLogger), {
    message: 'ReferenceError: x is not defined',
    name: 'RuntimeCrash',
  });
});

test('jobs do not share a global scope', async (t) => {
  const plan = createPlan([
    {
      id: 'job1',
      expression: 'export default [s => { x = 10; return s; }]',
      next: {
        b: true,
      },
    },
    {
      id: 'b',
      expression: 'export default [s => { s.data.x = x; return s; }]',
    },
  ]);
  console.log(JSON.stringify(plan, null, 2));

  await t.throwsAsync(() => execute(plan, {}, mockLogger), {
    message: 'ReferenceError: x is not defined',
    name: 'RuntimeCrash',
  });
});

test('jobs do not share a globalThis object', async (t) => {
  const plan = createPlan([
    {
      id: 'job1',
      expression: 'export default [(s) => { globalThis.x = 10; return s; }]',
      next: {
        b: true,
      },
    },
    {
      id: 'b',
      expression:
        'export default [(s) => { s.data.x = globalThis.x; return s; }]',
    },
  ]);
  const result = await execute(plan, {}, mockLogger);
  t.deepEqual(result, { data: {} });
});

// TODO this fails right now
// https://github.com/OpenFn/kit/issues/213
test.skip('jobs cannot scribble on globals', async (t) => {
  const plan = createPlan([
    {
      id: 'job1',
      expression: 'export default [s => { console.x = 10; return s; }]',
      next: {
        b: true,
      },
    },
    {
      id: 'b',
      expression: 'export default [s => { s.data.x = console.x; return s; }]',
    },
  ]);
  const result = await execute(plan, {}, mockLogger);
  t.falsy(result.data.x);
});

// TODO this fails right now
// https://github.com/OpenFn/kit/issues/213
test.skip('jobs cannot scribble on adaptor functions', async (t) => {
  const plan = createPlan([
    {
      id: 'job1',
      expression:
        'import { fn } from "@openfn/language-common"; fn.x = 10; export default [s => s]',
      next: {
        b: true,
      },
    },
    {
      id: 'b',
      expression:
        'import { fn } from "@openfn/language-common"; export default [s => { s.data.x = fn.x; return s; }]',
    },
  ]);
  const options = {
    linker: {
      modules: {
        '@openfn/language-common': {
          path: path.resolve('test/__modules__/@openfn/language-common'),
        },
      },
    },
  };

  const result = await execute(plan, options, mockLogger);
  t.falsy(result.data.x);
});

test('jobs can write circular references to state without blowing up downstream', async (t) => {
  const expression = `export default [(s) => {
    const a  = {};
    const b = { a };
    a.b = b;
    s.data = a

    return s;
  }]
`;
  const plan = createPlan([
    {
      id: 'job1',
      expression,
      next: { b: true },
    },
    {
      id: 'b',
      expression: 'export default [(s => s)]',
    },
  ]);

  const result = await execute(plan, {}, mockLogger);

  t.notThrows(() => JSON.stringify(result));
  t.deepEqual(result, {
    data: {
      b: {
        a: '[Circular]',
      },
    },
  });
});

test('jobs cannot pass circular references to each other', async (t) => {
  const expression = `export default [(s) => {
    const a  = {};
    const b = { a };
    a.b = b;
    s.data.ref = a

    return s;
  }]
`;
  const plan = createPlan([
    {
      expression,
      next: { b: true },
    },
    {
      id: 'b',
      expression: `export default [(s => {
            s.data.answer = s.data.ref.b.a;
            return s
          })]`,
    },
  ]);

  const result = await execute(plan, {}, mockLogger);

  t.notThrows(() => JSON.stringify(result));
  t.is(result.data.answer, '[Circular]');
});

test('jobs can write functions to state without blowing up downstream', async (t) => {
  const plan = createPlan([
    {
      next: { b: true },
      expression: `export default [(s) => {
            s.data = {
              x: () => 22
            }
        
            return s;
          }]`,
    },
    {
      id: 'b',
      expression: 'export default [(s) => s]',
    },
  ]);

  const result = await execute(plan, {}, mockLogger);

  t.notThrows(() => JSON.stringify(result));
  t.deepEqual(result, { data: {} });
});

test('jobs cannot pass functions to each other', async (t) => {
  const plan = createPlan([
    {
      next: { b: true },
      expression: `export default [(s) => {
            s.data = {
              x: () => 22
            }
        
            return s;
          }]`,
    },
    {
      id: 'b',
      expression: `export default [
            (s) => { s.data.x(); return s; }
          ]`,
    },
  ]);

  const result = await execute(plan, {}, mockLogger);

  const error = result.errors.b;
  t.is(error.type, 'TypeError');
  t.is(error.message, 'TypeError: s.data.x is not a function');
});

test('Plans log for each job start and end', async (t) => {
  const plan = createPlan([
    {
      id: 'a',
      expression: 'export default [s => s]',
    },
  ]);
  const logger = createMockLogger(undefined, { level: 'debug' });
  await execute(plan, {}, logger);

  const start = logger._find('always', /starting job/i);
  t.is(start!.message, 'Starting job a');

  const end = logger._find('success', /completed job/i);
  t.regex(end!.message as string, /Completed job a in \d+ms/);
});
