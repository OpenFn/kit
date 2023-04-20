import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';
import { ExecutionPlan, JobNode } from '../../src/types';
import execute from './../../src/execute/plan';

const opts = {};
const logger = createMockLogger();

const executePlan = (plan: ExecutionPlan, state = {}, options = opts): any =>
  execute(plan, state, options, logger);

test('report an error for a circular job', async (t) => {
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
  const result = await executePlan(plan);
  t.assert(result.hasOwnProperty('error'));
  t.regex(result.error.message, /circular dependency/i);
});

test('report an error for a job with multiple inputs', async (t) => {
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
  const result = await executePlan(plan);
  t.assert(result.hasOwnProperty('error'));
  t.regex(result.error.message, /multiple dependencies/i);
});

test('report an error for a plan which references an undefined job', async (t) => {
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
  const result = await executePlan(plan);
  t.assert(result.hasOwnProperty('error'));
  t.regex(result.error.message, /cannot find job/i);
});

test('report an error for an illegal edge condition', async (t) => {
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
  const result = await executePlan(plan);
  t.assert(result.hasOwnProperty('error'));
  t.regex(result.error.message, /failed to compile edge condition a->b/i);
});

test('report an error for an edge condition', async (t) => {
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
  const result = await executePlan(plan);
  t.assert(result.hasOwnProperty('error'));
  t.regex(result.error.message, /failed to compile edge condition/i);
});

test('execute a one-job execution plan with inline state', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression: 'export default [s => s.data.x]',
        data: { x: 22 }, // this is state.data, not state
      },
    ],
  };
  const result = (await executePlan(plan)) as unknown as number;
  t.is(result, 22);
});

test('execute a one-job execution plan with initial state', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression: 'export default [s => s.data.x]',
      },
    ],
  };
  const result = (await executePlan(plan, {
    data: { x: 33 },
  })) as unknown as number;
  t.is(result, 33);
});

// TODO this needs a radical restructure
// test('execute if the start condition is true', async (t) => {
//   const plan: ExecutionPlan = {
//     start: {
//       {
//         id: 'job1',
//         condition: 'state.data.x === 10',
//       },
//     },
//     jobs: [
//       {
//         id: 'job1',
//         expression: 'export default [s => s]',
//       },
//     ],
//   };
//   const result = await executePlan(plan, { data: { x: 10 } });
//   t.is((result.data as any).x, 10);
// });

// TODO this too
// test("don't execute if the start condition is false", async (t) => {
//   const plan: ExecutionPlan = {
//     start: {
//       {
//         id: 'job1',
//         condition: 'state.data.x === 10',
//       },
//     },
//     jobs: [
//       {
//         id: 'job1',
//         expression: 'export default [s => s]',
//       },
//     ],
//   };
//   const state = { data: { x: 0 } };
//   const result = await executePlan(plan, state);
//   t.deepEqual(result, state);
// });

test('merge initial and inline state', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression: 'export default [s => s]',
        data: { y: 11 },
      },
    ],
  };
  const result = await executePlan(plan, { data: { x: 33 } });
  t.is(result.data.x, 33);
  t.is(result.data.y, 11);
});

test('Initial state overrides inline data', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression: 'export default [s => s]',
        data: { x: 11 },
      },
    ],
  };
  const result = await executePlan(plan, { data: { x: 33 } });
  t.is(result.data.x, 33);
});

test('Previous state overrides inline data', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      // This will return x as 5
      {
        id: 'job1',
        expression: 'export default [s => s]',
        data: { x: 5 },
      },

      // This will receive x as 5, prefer it to the default x as 88, and return x as 5
      {
        id: 'job2',
        expression: 'export default [s => s]',
        data: { x: 88 },
      },
    ],
  };
  const result = await executePlan(plan);
  t.is(result.data.x, 5);
});

test('execute edge based on state in the condition', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        id: 'job1',
        data: {},
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
  const result = await executePlan(plan);
  t.is(result.data?.y, 20);
});

test('skip edge based on state in the condition ', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        id: 'job1',
        data: {},
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
  const result = await executePlan(plan);
  t.is(result.data?.x, 10);
});

test('execute a two-job execution plan', async (t) => {
  const plan: ExecutionPlan = {
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
  const result = await executePlan(plan, { data: { x: 0 } });
  t.is(result.data.x, 2);
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
  const result = await executePlan(plan);
  t.is(result.data.result, 11);
});

test('execute a two-job execution plan with custom start in options', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
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
  const result = await executePlan(plan, {}, { start: 'job2' });
  t.is(result.data.result, 11);
});

test('Return when there are no more edges', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
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
  const result = await executePlan(plan, { data: { x: 0 } });
  t.is(result.data?.x, 1);
});

test('execute a 5 job execution plan', async (t) => {
  const plan: ExecutionPlan = {
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
  const result = await executePlan(plan, { data: { x: 0 } });
  t.is(result.data.x, 5);
});

test('execute multiple steps in "parallel"', async (t) => {
  const plan: ExecutionPlan = {
    start: 'start',
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
  const result = await executePlan(plan, { data: { x: 0 } });
  t.is(result.data.x, 3);
});

test.serial('jobs do not share a local scope', async (t) => {
  const plan: ExecutionPlan = {
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
  await t.throwsAsync(() => executePlan(plan, { data: {} }));

  const last = logger._parse(logger._history.at(-1));
  t.is(last.message, 'ReferenceError: x is not defined');
});

test.serial('jobs do not share a global scope', async (t) => {
  const plan: ExecutionPlan = {
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
  await t.throwsAsync(() => executePlan(plan, { data: {} }));

  const last = logger._parse(logger._history.at(-1));
  t.is(last.message, 'ReferenceError: x is not defined');
});

test.serial('jobs do not share a this object', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression: 'export default [s => { this.x = 10; return s; }]',
        next: {
          b: true,
        },
      },
      {
        id: 'b',
        expression: 'export default [s => { s.data.x = this.x; return s; }]',
      },
    ],
  };
  await t.throwsAsync(() => executePlan(plan, { data: {} }));

  const last = logger._parse(logger._history.at(-1));
  t.is(
    last.message,
    "TypeError: Cannot set properties of undefined (setting 'x')"
  );
});

// TODO this fails right now
// https://github.com/OpenFn/kit/issues/213
test.skip('jobs cannot scribble on globals', async (t) => {
  const plan: ExecutionPlan = {
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
  const result = await executePlan(plan, { data: {} });
  t.falsy(result.data.x);
});

// TODO this fails right now
// https://github.com/OpenFn/kit/issues/213
test.skip('jobs cannot scribble on adaptor functions', async (t) => {
  const plan: ExecutionPlan = {
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
  const result = await executePlan(
    plan,
    { data: { x: 0 } },
    {
      linker: {
        modules: {
          '@openfn/language-common': {
            path: path.resolve('test/__modules__/@openfn/language-common'),
          },
        },
      },
    }
  );
  t.falsy(result.data.x);
});

test.serial(
  'jobs can write circular references to state without blowing up downstream',
  async (t) => {
    const expression = `export default [(s) => {
    const a  = {};
    const b = { a };
    a.b = b;
    s.data = a

    return s;
  }]
`;
    const plan: ExecutionPlan = {
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

    const result = await executePlan(plan, { data: {} });

    t.notThrows(() => JSON.stringify(result));
    t.deepEqual(result, {
      configuration: {},
      data: {
        b: {
          a: '[Circular]',
        },
      },
    });
  }
);

test.serial('jobs cannot pass circular references to each other', async (t) => {
  const expression = `export default [(s) => {
    const a  = {};
    const b = { a };
    a.b = b;
    s.data.ref = a

    return s;
  }]
`;
  const plan: ExecutionPlan = {
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

  const result = await executePlan(plan, { data: {} });

  t.notThrows(() => JSON.stringify(result));
  t.is(result.data.answer, '[Circular]');
});

test.serial(
  'jobs can write functions to state without blowing up downstream',
  async (t) => {
    const plan: ExecutionPlan = {
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

    const result = await executePlan(plan, { data: {} });

    t.notThrows(() => JSON.stringify(result));
    t.deepEqual(result, { data: {}, configuration: {} });
  }
);

test.serial('jobs cannot pass functions to each other', async (t) => {
  const plan: ExecutionPlan = {
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

  // TODO this will throw right now, but in future it might just write an error to state
  await t.throwsAsync(() => executePlan(plan, { data: {} }));
});
