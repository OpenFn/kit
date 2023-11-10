import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';
import { ExecutionPlan, JobNode } from '../../src/types';
import execute from './../../src/execute/plan';

let mockLogger = createMockLogger(undefined, { level: 'debug' });

test('throw for a circular job', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: [
      {
        id: 'job1',
        expression: 'export default [s => s]',
        next: { job2: true },
      },
      {
        id: 'job2',
        expression: 'export default [s => s]',
        next: { job1: true },
      },
    ],
  };
  const e = await t.throwsAsync(() => execute(plan, {}, mockLogger));
  t.regex(e!.message, /circular dependency/i);
});

test('throw for a job with multiple inputs', async (t) => {
  // TODO maybe this isn't a good test - job1 and job2 both input to job3, but job2 never gets called
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: [
      {
        id: 'job1',
        expression: 'export default [s => s]',
        next: { job3: true },
      },
      {
        id: 'job2',
        expression: 'export default [s => s]',
        next: { job3: true },
      },
      {
        id: 'job3',
        expression: 'export default [s => s]',
        next: {},
      },
    ],
  };
  const e = await t.throwsAsync(() => execute(plan, {}, mockLogger));
  t.regex(e!.message, /multiple dependencies/i);
});

test('throw for a plan which references an undefined job', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: [
      {
        id: 'job1',
        expression: 'export default [s => s]',
        next: { job3: true },
      },
    ],
  };
  const e = await t.throwsAsync(() => execute(plan, {}, mockLogger));
  t.regex(e!.message, /cannot find job/i);
});

test('throw for an illegal edge condition', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        id: 'a',
        expression: '.',
        next: {
          b: {
            condition: '!!!',
          },
        },
      },
      { id: 'b' },
    ],
  };
  const e = await t.throwsAsync(() => execute(plan, {}, mockLogger));
  t.regex(e!.message, /failed to compile edge condition a->b/i);
});

test('throw for an edge condition', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression: 'x',
        next: {
          b: {
            condition: '!!!!',
          },
        },
      },
      { id: 'b' },
    ],
  };
  const e = await t.throwsAsync(() => execute(plan, {}, mockLogger));
  t.regex(e!.message, /failed to compile edge condition/i);
});

test('execute a one-job execution plan with inline state', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression: 'export default [s => s.data.x]',
        state: { data: { x: 22 } },
      },
    ],
  };
  const result = (await execute(plan, {}, mockLogger)) as unknown as number;
  t.is(result, 22);
});

test('execute a one-job execution plan with initial state', async (t) => {
  const plan: ExecutionPlan = {
    initialState: {
      data: { x: 33 },
    },
    jobs: [
      {
        expression: 'export default [s => s.data.x]',
      },
    ],
  };
  const result = (await execute(plan, {}, mockLogger)) as unknown as number;
  t.is(result, 33);
});

test('lazy load initial state', async (t) => {
  const plan: ExecutionPlan = {
    initialState: 's1',
    jobs: [{ id: 'a', expression: 'export default [s => s]' }],
  };
  const states = { s1: { data: { result: 42 } } };
  const options = {
    callbacks: {
      resolveState: (id: string) => states[id],
    },
  };

  const result = await execute(plan, options, mockLogger);
  t.deepEqual(result, states.s1);
});

test.todo('lazy load initial state with log');
test.todo('lazy load initial state with notify');

test('execute a one-job execution plan and notify init-start and init-complete', async (t) => {
  let notifications: Record<string, any> = {};

  const state = {
    data: { x: 33 },
  };

  const plan: ExecutionPlan = {
    initialState: state,
    jobs: [
      {
        expression: 'export default [s => s.data.x]',
      },
    ],
  };

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
  const plan: ExecutionPlan = {
    jobs: [
      {
        next: {
          job: {
            condition: 'true',
          },
        },
      },
      {
        id: 'job',
        expression: 'export default [() => ({ data: { done: true } })]',
      },
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.true(result.data.done);
});

test('do not execute a job with a simple falsy "precondition" or "trigger node"', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        next: {
          job: {
            condition: 'false',
          },
        },
      },
      {
        id: 'job',
        expression: 'export default [() => ({ data: { done: true } })]',
      },
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.falsy(result.data.done);
});

test('execute a job with a valid "precondition" or "trigger node"', async (t) => {
  const plan: ExecutionPlan = {
    initialState: { data: { x: 10 } },
    jobs: [
      {
        next: {
          job: {
            condition: 'state.data.x === 10',
          },
        },
      },
      {
        id: 'job',
        expression: 'export default [() => ({ data: { done: true } })]',
      },
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.true(result.data.done);
});

test('merge initial and inline state', async (t) => {
  const plan: ExecutionPlan = {
    initialState: { data: { x: 33 } },
    jobs: [
      {
        expression: 'export default [s => s]',
        state: { data: { y: 11 } },
      },
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.x, 33);
  t.is(result.data.y, 11);
});

test('Initial state overrides inline data', async (t) => {
  const plan: ExecutionPlan = {
    initialState: { data: { x: 34 } },
    jobs: [
      {
        expression: 'export default [s => s]',
        state: { data: { x: 11 } },
      },
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.x, 34);
});

test('Previous state overrides inline data', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      // This will return x as 5
      {
        id: 'job1',
        expression: 'export default [s => s]',
        state: { data: { x: 5 } },
        next: {
          job2: true,
        },
      },

      // This will receive x as 5, prefer it to the default x as 88, and return it plus 1
      {
        id: 'job2',
        expression: 'export default [s => { s.data.x +=1 ; return s; }]',
        state: { data: { x: 88 } },
      },
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.x, 6);
});

test('only allowed state is passed through in strict mode', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression:
          'export default [s => ({ data: {}, references: [], x: 22, y: 33 })]',
        next: {
          job2: true,
        },
      },

      {
        id: 'job2',
        // Throw if we receive unexpected stuff in state
        expression:
          'export default [s => { if (s.x || s.y) { throw new Error() }; return s;}]',
      },
    ],
  };
  const result = await execute(plan, { strict: true }, mockLogger);
  t.deepEqual(result, {
    data: {},
    references: [],
  });
});

test('Jobs only receive state from upstream jobs', async (t) => {
  const assert = (expr: string) =>
    `if (!(${expr})) throw new Error('ASSERT FAIL')`;

  const plan: ExecutionPlan = {
    jobs: [
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
    ],
  };

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
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression:
          'export default [s => ({ data: {}, references: [], x: 22, y: 33 })]',
        next: {
          job2: true,
        },
      },

      {
        id: 'job2',
        // Throw if we receive unexpected stuff in state
        expression:
          'export default [s => { if (!s.x || !s.y || !s.references) { throw new Error() }; return s;}]',
      },
    ],
  };
  const result = await execute(plan, { strict: false }, mockLogger);
  t.deepEqual(result, {
    data: {},
    references: [],
    x: 22,
    y: 33,
  });
});

test('execute edge based on state in the condition', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
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
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data?.y, 20);
});

test('skip edge based on state in the condition ', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
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
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data?.x, 10);
});

test('do not traverse a disabled edge', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
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
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data?.x, 10);
});

test('execute a two-job execution plan', async (t) => {
  const plan: ExecutionPlan = {
    initialState: { data: { x: 0 } },
    jobs: [
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
  };
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.x, 2);
});

test('only execute one job in a two-job execution plan', async (t) => {
  const plan: ExecutionPlan = {
    initialState: { data: { x: 0 } },
    jobs: [
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
  };
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.x, 1);
});

test('execute a two-job execution plan with custom start in state', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job2',
    jobs: [
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
  };
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.result, 11);
});

test('execute a two-job execution plan with custom start in options', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    initialState: { start: 'job2' },
    jobs: [
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
  };
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.result, 11);
});

test('Return when there are no more edges', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    initialState: { data: { x: 0 } },
    jobs: [
      {
        id: 'job1',
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
      {
        id: 'job2',
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data?.x, 1);
});

test('execute a 5 job execution plan', async (t) => {
  const plan: ExecutionPlan = {
    initialState: { data: { x: 0 } },
    start: '1',
    jobs: [],
  } as ExecutionPlan;
  for (let i = 1; i < 6; i++) {
    plan.jobs.push({
      id: `${i}`,
      expression: 'export default [s => { s.data.x += 1; return s; } ]',
      next: i === 5 ? null : { [`${i + 1}`]: true },
    } as JobNode);
  }
  const result = await execute(plan, {}, mockLogger);
  t.is(result.data.x, 5);
});

test('execute multiple steps in "parallel"', async (t) => {
  const plan: ExecutionPlan = {
    start: 'start',
    initialState: { data: { x: 0 } },
    jobs: [
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
  };
  const result = await execute(plan, {}, mockLogger);
  t.deepEqual(result, {
    a: { data: { x: 1 } },
    b: { data: { x: 1 } },
    c: { data: { x: 1 } },
  });
});

test('return an error in state', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        id: 'a',
        state: {},
        expression: 'export default [s => { throw Error("e")}]',
      },
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.truthy(result.errors);
  t.is(result.errors.a.message, 'e');
});

// Fix for https://github.com/OpenFn/kit/issues/317
test('handle non-standard error objects', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        id: 'a',
        state: {},
        expression: 'export default [s => { throw "wibble" }]',
      },
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.truthy(result.errors);
  const err = result.errors.a;
  t.is(err.type, 'UserError');
  t.is(err.message, 'wibble');
});

test('keep executing after an error', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
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
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.is(result.y, 20);
  t.falsy(result.x);
});

test('simple on-error handler', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
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
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.is(result.y, 20);
  t.falsy(result.x);
});

test('log appopriately on error', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        id: 'job1',
        state: {},
        expression: 'export default [s => { throw Error("e")}]',
      },
    ],
  };

  const logger = createMockLogger(undefined, { level: 'debug' });

  await execute(plan, {}, logger);

  const err = logger._find('error', /failed job/i);
  t.truthy(err);
  t.regex(err!.message as string, /Failed job job1 after \d+ms/i);

  t.truthy(logger._find('error', /UserError: e/));
  t.truthy(logger._find('error', /Check state.errors.job1 for details/i));
});

test('jobs do not share a local scope', async (t) => {
  const plan: ExecutionPlan = {
    initialState: { data: {} },
    jobs: [
      {
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
  };
  await t.throwsAsync(() => execute(plan, {}, mockLogger), {
    message: 'ReferenceError: x is not defined',
    name: 'RuntimeCrash',
  });
});

test('jobs do not share a global scope', async (t) => {
  const plan: ExecutionPlan = {
    initialState: { data: {} },
    jobs: [
      {
        expression: 'export default [s => { x = 10; return s; }]',
        next: {
          b: true,
        },
      },
      {
        id: 'b',
        expression: 'export default [s => { s.data.x = x; return s; }]',
      },
    ],
  };

  await t.throwsAsync(() => execute(plan, {}, mockLogger), {
    message: 'ReferenceError: x is not defined',
    name: 'RuntimeCrash',
  });
});

test('jobs do not share a globalThis object', async (t) => {
  const plan: ExecutionPlan = {
    initialState: { data: {} },
    jobs: [
      {
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
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.deepEqual(result, { data: {} });
});

// TODO this fails right now
// https://github.com/OpenFn/kit/issues/213
test.skip('jobs cannot scribble on globals', async (t) => {
  const plan: ExecutionPlan = {
    initialState: { data: {} },
    jobs: [
      {
        expression: 'export default [s => { console.x = 10; return s; }]',
        next: {
          b: true,
        },
      },
      {
        id: 'b',
        expression: 'export default [s => { s.data.x = console.x; return s; }]',
      },
    ],
  };
  const result = await execute(plan, {}, mockLogger);
  t.falsy(result.data.x);
});

// TODO this fails right now
// https://github.com/OpenFn/kit/issues/213
test.skip('jobs cannot scribble on adaptor functions', async (t) => {
  const plan: ExecutionPlan = {
    initialState: { data: { x: 0 } },
    jobs: [
      {
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
    ],
  };
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
  const plan: ExecutionPlan = {
    initialState: { data: {} },
    jobs: [
      {
        expression,
        next: { b: true },
      },
      {
        id: 'b',
        expression: 'export default [(s => s)]',
      },
    ],
  };

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
  const plan: ExecutionPlan = {
    initialState: { data: {} },
    jobs: [
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
    ],
  };

  const result = await execute(plan, {}, mockLogger);

  t.notThrows(() => JSON.stringify(result));
  t.is(result.data.answer, '[Circular]');
});

test('jobs can write functions to state without blowing up downstream', async (t) => {
  const plan: ExecutionPlan = {
    initialState: { data: {} },
    jobs: [
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
    ],
  };

  const result = await execute(plan, {}, mockLogger);

  t.notThrows(() => JSON.stringify(result));
  t.deepEqual(result, { data: {} });
});

test('jobs cannot pass functions to each other', async (t) => {
  const plan: ExecutionPlan = {
    initialState: { data: {} },
    jobs: [
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
    ],
  };

  const result = await execute(plan, {}, mockLogger);

  const error = result.errors.b;
  t.is(error.type, 'TypeError');
  t.is(error.message, 'TypeError: s.data.x is not a function');
});

test('Plans log for each job start and end', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        id: 'a',
        expression: 'export default [s => s]',
      },
    ],
  };
  const logger = createMockLogger(undefined, { level: 'debug' });
  await execute(plan, {}, logger);

  const start = logger._find('always', /starting job/i);
  t.is(start!.message, 'Starting job a');

  const end = logger._find('success', /completed job/i);
  t.regex(end!.message as string, /Completed job a in \d+ms/);
});
