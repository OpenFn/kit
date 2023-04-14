import test from 'ava';
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
    jobs: {
      job1: {
        expression: 'export default [s => s]',
        next: { job2: true },
      },
      job2: {
        expression: 'export default [s => s]',
        next: { job1: true },
      },
    },
  };
  const result = await executePlan(plan);
  t.assert(result.hasOwnProperty('error'));
  t.regex(result.error.message, /circular dependency/i);
});

test('report an error for a job with multiple inputs', async (t) => {
  // TODO maybe this isn't a good test - job1 and job2 both input to job3, but job2 never gets called
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: {
      job1: {
        expression: 'export default [s => s]',
        next: { job3: true },
      },
      job2: {
        expression: 'export default [s => s]',
        next: { job3: true },
      },
      job3: {
        expression: 'export default [s => s]',
        next: {},
      },
    },
  };
  const result = await executePlan(plan);
  t.assert(result.hasOwnProperty('error'));
  t.regex(result.error.message, /multiple dependencies/i);
});

test('report an error for a plan which references an undefined job', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: {
      job1: {
        expression: 'export default [s => s]',
        next: { job3: true },
      },
    },
  };
  const result = await executePlan(plan);
  t.assert(result.hasOwnProperty('error'));
  t.regex(result.error.message, /cannot find job/i);
});

test('report an error for an illegal start condition', async (t) => {
  const plan: ExecutionPlan = {
    start: { a: { condition: '!!!!' } },
    jobs: {
      a: {
        expression: '.',
      },
    },
  };
  const result = await executePlan(plan);
  t.assert(result.hasOwnProperty('error'));
  t.regex(result.error.message, /failed to compile edge condition start->a/i);
});

test('report an error for an edge condition', async (t) => {
  const plan: ExecutionPlan = {
    start: 'a',
    jobs: {
      a: {
        expression: 'x',
        next: {
          b: {
            condition: '!!!!',
          },
        },
      },
      b: {
        expression: 'x',
      },
    },
  };
  const result = await executePlan(plan);
  t.assert(result.hasOwnProperty('error'));
  t.regex(result.error.message, /failed to compile edge condition/i);
});

test('execute a one-job execution plan with inline state', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: {
      job1: {
        expression: 'export default [s => s.data.x]',
        data: { x: 22 }, // this is state.data, not state
      },
    },
  };
  const result = (await executePlan(plan)) as unknown as number;
  t.is(result, 22);
});

test('execute a one-job execution plan with initial state', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: {
      job1: {
        expression: 'export default [s => s.data.x]',
      },
    },
  };
  const result = (await executePlan(plan, {
    data: { x: 33 },
  })) as unknown as number;
  t.is(result, 33);
});

test('execute if the start condition is true', async (t) => {
  const plan: ExecutionPlan = {
    start: {
      job1: {
        condition: 'state.data.x === 10',
      },
    },
    jobs: {
      job1: {
        expression: 'export default [s => s]',
      },
    },
  };
  const result = await executePlan(plan, { data: { x: 10 } });
  t.is((result.data as any).x, 10);
});

test("don't execute if the start condition is false", async (t) => {
  const plan: ExecutionPlan = {
    start: {
      job1: {
        condition: 'state.data.x === 10',
      },
    },
    jobs: {
      job1: {
        expression: 'export default [s => s]',
      },
    },
  };
  const state = { data: { x: 0 } };
  const result = await executePlan(plan, state);
  t.deepEqual(result, state);
});

test('merge initial and inline state', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: {
      job1: {
        expression: 'export default [s => s]',
        data: { y: 11 },
      },
    },
  };
  const result = await executePlan(plan, { data: { x: 33 } });
  t.is(result.data.x, 33);
  t.is(result.data.y, 11);
});

test('Initial state overrides inline data', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: {
      job1: {
        expression: 'export default [s => s]',
        data: { x: 11 },
      },
    },
  };
  const result = await executePlan(plan, { data: { x: 33 } });
  t.is(result.data.x, 33);
});

test('Previous state overrides inline data', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: {
      // This will return x as 5
      job1: {
        expression: 'export default [s => s]',
        data: { x: 5 },
      },

      // This will receive x as 5, prefer it to the default x as 88, and return x as 5
      job2: {
        expression: 'export default [s => s]',
        data: { x: 88 },
      },
    },
  };
  const result = await executePlan(plan);
  t.is(result.data.x, 5);
});

test('execute edge based on state in the condition', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: {
      job1: {
        data: {},
        expression: 'export default [(s) => { s.data.x = 10; return s;}]',
        next: { job2: { condition: 'state.data.x === 10' } },
      },
      job2: {
        expression: 'export default [() => ({ data: { y: 20 } })]',
      },
    },
  };
  const result = await executePlan(plan);
  t.is(result.data?.y, 20);
});

test('skip edge based on state in the condition ', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: {
      job1: {
        data: {},
        expression: 'export default [s => { s.data.x = 10; return s;}]',
        next: { job2: { condition: 'false' } },
      },
      job2: {
        expression: 'export default [() => ({ y: 20 })]',
      },
    },
  };
  const result = await executePlan(plan);
  t.is(result.data?.x, 10);
});

test('execute a two-job execution plan', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: {
      job1: {
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
        next: { job2: true },
      },
      job2: {
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
    },
  };
  const result = await executePlan(plan, { data: { x: 0 } });
  t.is(result.data.x, 2);
});

test('Return the result of the first expression without an edge', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: {
      job1: {
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
      job2: {
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
    },
  };
  const result = await executePlan(plan, { data: { x: 0 } });
  t.is(result.data?.x, 1);
});

test('execute a two-job execution plan from job 2', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job2',
    jobs: {
      job1: {
        expression: 'export default [s => { s.data.y = 1; return s; } ]',
      },
      job2: {
        expression: 'export default [s => { s.data.x = 1; return s; } ]',
      },
    },
  };
  const result = await executePlan(plan, { data: { x: 0 } });
  t.is(result.data?.x, 1);
  t.is(result.data?.y, undefined);
});

test('execute a 5 job execution plan', async (t) => {
  const plan: ExecutionPlan = {
    start: '1',
    jobs: {},
  } as ExecutionPlan;
  for (let i = 1; i < 6; i++) {
    plan.jobs[`${i}`] = {
      expression: 'export default [s => { s.data.x += 1; return s; } ]',
      next: i === 5 ? null : { [`${i + 1}`]: true },
    } as JobNode;
  }
  const result = await executePlan(plan, { data: { x: 0 } });
  t.is(result.data.x, 5);
});

test('execute multiple steps in "parallel"', async (t) => {
  const plan: ExecutionPlan = {
    start: 'start',
    jobs: {
      start: {
        expression: 'export default [s => s]',
        next: {
          a: true,
          b: true,
          c: true,
        },
      },
      a: {
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
      b: {
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
      c: {
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
    },
  };
  const result = await executePlan(plan, { data: { x: 0 } });
  t.is(result.data.x, 3);
});

test.serial('jobs do not share a local scope', async (t) => {
  const plan: ExecutionPlan = {
    start: 'a',
    jobs: {
      a: {
        // declare x in this expression's scope
        expression: 'const x = 10; export default [s => s];',
        next: {
          b: true,
        },
      },
      b: {
        // x should not defined here and this will throw
        expression: 'export default [s => { s.data.x = x; return s; }]',
      },
    },
  };
  await t.throwsAsync(() => executePlan(plan, { data: {} }));

  const last = logger._parse(logger._history.at(-1));
  t.is(last.message, 'ReferenceError: x is not defined');
});

test.serial('jobs do not share a global scope', async (t) => {
  const plan: ExecutionPlan = {
    start: 'a',
    jobs: {
      a: {
        expression: 'export default [s => { x = 10; return s; }]',
        next: {
          b: true,
        },
      },
      b: {
        expression: 'export default [s => { s.data.x = x; return s; }]',
      },
    },
  };
  await t.throwsAsync(() => executePlan(plan, { data: {} }));

  const last = logger._parse(logger._history.at(-1));
  t.is(last.message, 'ReferenceError: x is not defined');
});

test.serial('jobs do not share a this object', async (t) => {
  const plan: ExecutionPlan = {
    start: 'a',
    jobs: {
      a: {
        expression: 'export default [s => { this.x = 10; return s; }]',
        next: {
          b: true,
        },
      },
      b: {
        expression: 'export default [s => { s.data.x = this.x; return s; }]',
      },
    },
  };
  await t.throwsAsync(() => executePlan(plan, { data: {} }));

  const last = logger._parse(logger._history.at(-1));
  t.is(
    last.message,
    "TypeError: Cannot set properties of undefined (setting 'x')"
  );
});

// TODO this fails right now
// That probably means we ought to freeze the context object
// Although that causes everything to fail...
test.skip('jobs cannot scribble on globals', async (t) => {
  const plan: ExecutionPlan = {
    start: 'a',
    jobs: {
      a: {
        expression: 'export default [s => { console.x = 10; return s; }]',
        next: {
          b: true,
        },
      },
      b: {
        expression: 'export default [s => { s.data.x = console.x; return s; }]',
      },
    },
  };
  const result = await executePlan(plan, { data: {} });
  t.falsy(result.data.x);
});

// TODO common won't load unless we do some special setup
test.skip('jobs cannot scribble on adaptor functions', async (t) => {
  const plan: ExecutionPlan = {
    start: 'a',
    jobs: {
      a: {
        expression:
          'import { fn } from "openfn/language-common"; fn.x = 10; export default [s => { global.x = 10; return s; }]',
        next: {
          b: true,
        },
      },
      b: {
        expression:
          'import { fn } from "openfn/language-common"; export default [s => { s.data.x = fn.x; return s; }]',
      },
    },
  };
  const result = await executePlan(plan, { data: { x: 0 } });
  t.falsy(result.data.x);
});
