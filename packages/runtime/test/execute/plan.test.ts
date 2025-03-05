import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';
import type { ExecutionPlan, Job } from '@openfn/lexicon';

import executePlan from './../../src/execute/plan';
import { CompiledExecutionPlan } from '../../src';

let mockLogger = createMockLogger(undefined, { level: 'debug' });

const createPlan = (
  steps: Job[],
  options: Partial<CompiledExecutionPlan['options']> = {},
  globals?: string
): ExecutionPlan => ({
  workflow: {
    globals,
    steps,
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
  const e = await t.throwsAsync(() => executePlan(plan, {}, {}, mockLogger));
  t.regex(e!.message, /circular dependency/i);
});

test('throw for a plan which references an undefined job', async (t) => {
  const plan = createPlan([createJob({ next: { job3: true } })]);

  const e = await t.throwsAsync(() => executePlan(plan, {}, {}, mockLogger));
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
  const e = await t.throwsAsync(() => executePlan(plan, {}, {}, mockLogger));
  t.regex(e!.message, /failed to compile edge condition job1->job2/i);
});

test('execute a one-job execution plan with inline state', async (t) => {
  const plan = createPlan([
    createJob({
      expression: 'export default [s => s.data.x]',
      state: { data: { x: 22 } },
    }),
  ]);

  const result: any = (await executePlan(
    plan,
    {},
    {},
    mockLogger
  )) as unknown as number;
  t.is(result, 22);
});

test('execute a one-job execution plan with initial state', async (t) => {
  const plan = createPlan([
    createJob({
      expression: 'export default [s => s.data.x]',
    }),
  ]);
  const input = {
    data: { x: 33 },
  };

  const result: any = await executePlan(plan, input, {}, mockLogger);

  t.is(result, 33);
});

test('lazy load initial state', async (t) => {
  const plan = createPlan([
    createJob({
      expression: 'export default [s => s]',
    }),
  ]);
  const state = 's1';

  const states = { s1: { data: { result: 42 } } };
  const options = {
    callbacks: {
      resolveState: (id: string) => states[id],
    },
  };

  const result: any = await executePlan(plan, state, options, mockLogger);
  t.deepEqual(result, states.s1);
});

test('execute a one-job execution plan and notify init-start and init-complete', async (t) => {
  let notifications: Record<string, any> = {};

  const state = {
    data: { x: 33 },
  };

  const plan = createPlan([
    createJob({
      expression: 'export default [s => s.data.x]',
    }),
  ]);

  const notify = (event: string, payload: any) => {
    if (notifications[event]) {
      throw new Error(`event ${event} called twice!`);
    }
    notifications[event] = payload || true;
  };

  const options = { callbacks: { notify } };

  await executePlan(plan, state, options, mockLogger);

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

  const result: any = await executePlan(plan, {}, {}, mockLogger);
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);
  t.true(result.data.done);
});

test('merge initial and inline state', async (t) => {
  const plan = createPlan([
    createJob({
      expression: 'export default [s => s]',
      state: { data: { y: 11 } },
    }),
  ]);
  const state = { data: { x: 33 } };

  const result: any = await executePlan(plan, state, {}, mockLogger);
  t.is(result.data.x, 33);
  t.is(result.data.y, 11);
});

test('Initial state overrides inline data', async (t) => {
  const plan = createPlan([
    createJob({
      expression: 'export default [s => s]',
      state: { data: { y: 11 } },
    }),
  ]);
  const state = { data: { x: 34 } };

  const result: any = await executePlan(plan, state, {}, mockLogger);
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);
  t.is(result.data.x, 6);
});

test('steps only receive state from upstream steps', async (t) => {
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);

  // explicit check that no assertion failed and wrote an error to state
  t.falsy(result.error);

  // Check there are two results
  t.deepEqual(result, {
    'x-b': { data: { x: 2, y: 1 } },
    'y-b': { data: { x: 1, y: 2 } },
  });
});

test('all state is passed through successive jobs', async (t) => {
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);
  t.deepEqual(result, {
    data: {},
    references: [],
    x: 22,
    y: 33,
  });
});

test('execute the same step twice', async (t) => {
  let callCount = 0;
  const notify = (evt: string, payload: any) => {
    if (evt === 'job-start' && payload.jobId === 'x') {
      callCount += 1;
    }
  };
  const plan = createPlan([
    createJob({
      id: 'start',
      expression: 'export default [s => s]',
      next: { a: true, b: true },
    }),

    createJob({
      id: 'a',
      expression: 'export default [s => s]',
      next: { x: true },
    }),
    createJob({
      id: 'b',
      expression: 'export default [s => s]',
      next: { x: true },
    }),

    createJob({
      id: 'x',
      expression: 'export default [s => s]',
    }),
  ]);

  await executePlan(plan, {}, { callbacks: { notify } }, mockLogger);

  t.is(callCount, 2);
});

test('A step executing twice should have two different inputs', async (t) => {
  const plan = createPlan([
    createJob({
      id: 'start',
      expression: 'export default [s => s]',
      next: { a: true, b: true },
    }),

    createJob({
      id: 'a',
      expression: 'export default [s => ({ ...s, a: true })]',
      next: { x: true },
    }),
    createJob({
      id: 'b',
      expression: 'export default [s => ({ ...s, b: true })]',
      next: { x: true },
    }),

    // x should receive two distinct and unique state objects
    // This will throw if any state is shared between a and b
    createJob({
      id: 'x',
      expression:
        'export default [s => { if (s.a && s.b) throw new Error("SHARED STATE") }]',
    }),
  ]);

  await executePlan(plan, {}, {}, mockLogger);

  t.pass('state not shared');
});

test('Return multiple results for leaf step that executes multiple times', async (t) => {
  const plan = createPlan([
    createJob({
      id: 'start',
      expression: 'export default [s => s]',
      next: { a: true, b: true },
    }),

    createJob({
      id: 'a',
      expression: 'export default [s => ({ ...s, a: true })]',
      next: { x: true },
    }),
    createJob({
      id: 'b',
      expression: 'export default [s => ({ ...s, b: true })]',
      next: { x: true },
    }),

    createJob({
      id: 'x',
      expression: 'export default [s => Object.keys(s)]',
    }),
  ]);

  const result = await executePlan(plan, {}, {}, mockLogger);
  t.deepEqual(result, {
    x: ['data', 'a', 'configuration'],
    'x-1': ['data', 'b', 'configuration'],
  });
});

test('Downstream nodes get executed multiple times', async (t) => {
  let callCount = 0;
  const notify = (evt: string, payload: any) => {
    if (evt === 'job-start' && payload.jobId === 'y') {
      callCount += 1;
    }
  };

  const plan = createPlan([
    createJob({
      id: 'start',
      expression: 'export default [s => s]',
      next: { a: true, b: true },
    }),

    createJob({
      id: 'a',
      expression: 'export default [s => ({ ...s, a: true })]',
      next: { x: true },
    }),
    createJob({
      id: 'b',
      expression: 'export default [s => ({ ...s, b: true })]',
      next: { x: true },
    }),

    createJob({
      id: 'x',
      expression: 'export default [s => ({ ...s, x: true })]',
      next: { y: true },
    }),

    // This should be called twice with different inputs
    createJob({
      id: 'y',
      expression: 'export default [s => Object.keys(s)]',
    }),
  ]);

  const result = await executePlan(
    plan,
    {},
    { callbacks: { notify } },
    mockLogger
  );
  t.is(callCount, 2);
  t.deepEqual(result, {
    y: ['data', 'a', 'x', 'configuration'],
    'y-1': ['data', 'b', 'x', 'configuration'],
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
  const result: any = await executePlan(plan, {}, {}, mockLogger);
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
  const result: any = await executePlan(plan, {}, {}, mockLogger);
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
  const result: any = await executePlan(plan, {}, {}, mockLogger);
  t.is(result.data?.x, 10);
});

test('execute a two-job execution plan', async (t) => {
  const plan = createPlan([
    {
      id: 'job1',
      expression: 'export default [s => { s.data.x += 1; return s; } ]',
      next: { job2: true },
    },
    {
      id: 'job2',
      expression: 'export default [s => { s.data.x += 1; return s; } ]',
    },
  ]);
  const state = { data: { x: 0 } };

  const result: any = await executePlan(plan, state, {}, mockLogger);
  t.is(result.data.x, 2);
});

test('only execute one job in a two-job execution plan', async (t) => {
  const plan = createPlan([
    {
      id: 'job1',
      expression: 'export default [s => { s.data.x += 1; return s; } ]',
      next: { job2: false },
    },
    {
      id: 'job2',
      expression: 'export default [s => { s.data.x += 1; return s; } ]',
    },
  ]);
  const state = { data: { x: 0 } };
  const result: any = await executePlan(plan, state, {}, mockLogger);
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);
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
    { start: 'job1' }
  );
  const state = { data: { x: 0 } };

  const result: any = await executePlan(plan, state, {}, mockLogger);
  t.is(result.data?.x, 1);
});

test('execute a 5 job execution plan', async (t) => {
  const steps = [];
  for (let i = 1; i < 6; i++) {
    steps.push({
      id: `${i}`,
      expression: 'export default [s => { s.data.x += 1; return s; } ]',
      next: i === 5 ? null : { [`${i + 1}`]: true },
    } as Job);
  }

  const plan = createPlan(steps, {
    start: '1',
  });
  const state = { data: { x: 0 } };

  const result: any = await executePlan(plan, state, {}, mockLogger);
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
    { start: 'start' }
  );
  const state = { data: { x: 0 } };

  const result: any = await executePlan(plan, state, {}, mockLogger);
  t.deepEqual(result, {
    a: { data: { x: 1 } },
    b: { data: { x: 1 } },
    c: { data: { x: 1 } },
  });
});

test('ignore leaf nodes with no result', async (t) => {
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
        expression: 'export default [s => null ]',
      },
      {
        id: 'c',
        expression: 'export default [s => null ]',
      },
    ],
    { start: 'start' }
  );
  const state = { data: { x: 0 } };

  const result: any = await executePlan(plan, state, {}, mockLogger);
  t.deepEqual(result, { data: { x: 1 } });
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
    { start: 'start' }
  );
  const state = { data: { x: 0 } };

  const result: any = await executePlan(plan, state, {}, mockLogger);
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
    { start: 'start' }
  );
  const state = { data: { x: 0 } };

  const result: any = await executePlan(plan, state, {}, mockLogger);
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);
  t.truthy(result.errors);
  const err = result.errors.a;
  t.deepEqual(err, {
    source: 'runtime',
    name: 'JobError',
    severity: 'fail',
    message: 'wibble',
  });
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);
  t.is(result.y, 20);
  t.falsy(result.x);
});

test('log appropriately on error', async (t) => {
  const plan = createPlan([
    {
      id: 'job1',
      state: {},
      expression: 'export default [s => { throw Error("e")}]',
    },
  ]);

  const logger = createMockLogger(undefined, { level: 'debug' });
  await executePlan(plan, {}, {}, logger);

  const err = logger._find('error', /aborted with error/i);
  t.truthy(err);
  t.log('msg:', err?.message);
  t.regex(err!.message as string, /job1 aborted with error \(\d+ms\)/i);

  t.truthy(logger._find('error', /Check state.errors.job1 for details/i));

  const [_level, _icon, errMessage]: any = logger._history.at(-2);
  t.deepEqual(errMessage, 'e');
});

test('steps do not share a local scope', async (t) => {
  const plan = createPlan([
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
  ]);
  await t.throwsAsync(() => executePlan(plan, {}, {}, mockLogger), {
    message: 'ReferenceError: x is not defined',
    name: 'RuntimeCrash',
  });
});

test('steps do not share a global scope', async (t) => {
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

  await t.throwsAsync(() => executePlan(plan, {}, {}, mockLogger), {
    message: 'ReferenceError: x is not defined',
    name: 'RuntimeCrash',
  });
});

test('steps do not share a globalThis object', async (t) => {
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);
  t.deepEqual(result, { data: {} });
});

// TODO this fails right now
// https://github.com/OpenFn/kit/issues/213
test.skip('steps cannot scribble on globals', async (t) => {
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);
  t.falsy(result.data.x);
});

// TODO this fails right now
// https://github.com/OpenFn/kit/issues/213
test.skip('steps cannot scribble on adaptor functions', async (t) => {
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

  const result: any = await executePlan(plan, {}, options, mockLogger);
  t.falsy(result.data.x);
});

test('steps can write circular references to state without blowing up downstream', async (t) => {
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);

  t.notThrows(() => JSON.stringify(result));
  t.deepEqual(result, {
    data: {
      b: {
        a: '[Circular]',
      },
    },
  });
});

test('steps cannot pass circular references to each other', async (t) => {
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);

  t.notThrows(() => JSON.stringify(result));
  t.is(result.data.answer, '[Circular]');
});

test('steps can write functions to state without blowing up downstream', async (t) => {
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);

  t.notThrows(() => JSON.stringify(result));
  t.deepEqual(result, { data: {} });
});

test('steps cannot pass functions to each other', async (t) => {
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

  const result: any = await executePlan(plan, {}, {}, mockLogger);

  const error = result.errors.b;

  t.deepEqual(error, {
    source: 'runtime',
    severity: 'fail',
    name: 'RuntimeError',
    subtype: 'TypeError',
    message: 'TypeError: s.data.x is not a function',
    pos: {
      column: 29,
      line: 2,
    },
  });
});

test('Plans log step ids for each job start and end', async (t) => {
  const plan = createPlan([
    {
      id: 'a',
      expression: 'export default [s => s]',
    },
  ]);
  const logger = createMockLogger(undefined, { level: 'debug' });
  await executePlan(plan, {}, {}, logger);
  const start = logger._find('info', /starting step a/i);
  t.is(start!.message, 'Starting step a');

  const end = logger._find('success', /completed in/i);
  t.regex(end!.message as string, /a completed in \d+ms/);
});

test('Plans log step names for each job start and end', async (t) => {
  const plan = createPlan([
    {
      id: 'a',
      name: 'do-the-thing',
      expression: 'export default [s => s]',
    },
  ]);
  const logger = createMockLogger(undefined, { level: 'debug' });
  await executePlan(plan, {}, {}, logger);

  const start = logger._find('info', /starting step do-the-thing/i);
  t.is(start!.message, 'Starting step do-the-thing');

  const end = logger._find('success', /do-the-thing completed in/i);
  t.regex(end!.message as string, /do-the-thing completed in \d+ms/);
});

test.serial(
  'global functions should be scoped per step or job code',
  async (t) => {
    const functions = `
    export const addToBase = ((a) => (b) => { a = a + b; return a })(0); 
    export const INC = 5;
    `;
    const plan = createPlan(
      [
        {
          id: 'a',
          name: 'do-a',
          expression:
            'export default [s => {addToBase(INC); return s;}, s => {state.data.a = addToBase(INC); return state;}]',
          next: {
            b: true,
          },
        },
        {
          id: 'b',
          name: 'do-b',
          expression:
            'export default [s => {addToBase(INC); return s;}, s => {state.data.b = addToBase(INC); return state;}]',
        },
      ],
      {},
      functions
    );

    const result: any = await executePlan(plan, {}, {}, mockLogger);

    t.notThrows(() => JSON.stringify(result));
    t.deepEqual(result.data, { a: 10, b: 10 });
  }
);
