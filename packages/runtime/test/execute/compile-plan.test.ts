import test from 'ava';
import { ExecutionPlan, JobEdge } from '../../src';

import compilePlan from '../../src/execute/compile-plan';

const testPlan: ExecutionPlan = {
  start: 'a',
  jobs: [
    { id: 'a', expression: 'x', next: { b: true } },
    { id: 'b', expression: 'y' },
  ],
};

const planWithEdge = (edge: JobEdge) =>
  ({
    ...testPlan,
    jobs: [{ id: 'a', next: { b: edge } }],
  } as ExecutionPlan);

test('should convert jobs to an object', (t) => {
  const compiledPlan = compilePlan(testPlan);
  t.truthy(compiledPlan.jobs.a);
  t.is(compiledPlan.jobs.a.expression, 'x');

  t.truthy(compiledPlan.jobs.b);
  t.is(compiledPlan.jobs.b.expression, 'y');
});

test('should set previous job with 2 jobs', (t) => {
  const plan: ExecutionPlan = {
    start: 'a',
    jobs: [
      { id: 'a', expression: 'x', next: { b: true } },
      { id: 'b', expression: 'y' },
    ],
  };
  const compiledPlan = compilePlan(plan);
  t.is(compiledPlan.jobs.a.previous, undefined);
  t.is(compiledPlan.jobs.b.previous, 'a');
});

test('should set previous job with 2 jobs and shorthand syntax', (t) => {
  const plan: ExecutionPlan = {
    start: 'a',
    jobs: [
      { id: 'a', expression: 'x', next: 'b' },
      { id: 'b', expression: 'y' },
    ],
  };
  const compiledPlan = compilePlan(plan);
  t.is(compiledPlan.jobs.a.previous, undefined);
  t.is(compiledPlan.jobs.b.previous, 'a');
});

test('should set previous job with 2 jobs and no start', (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      { id: 'a', expression: 'x', next: { b: true } },
      { id: 'b', expression: 'y' },
    ],
  };
  const compiledPlan = compilePlan(plan);
  t.is(compiledPlan.jobs.a.previous, undefined);
  t.is(compiledPlan.jobs.b.previous, 'a');
});

test('should set previous job with 3 jobs', (t) => {
  const plan: ExecutionPlan = {
    start: 'a',
    jobs: [
      { id: 'a', expression: 'x', next: { b: true } },
      { id: 'b', expression: 'y', next: { c: true } },
      { id: 'c', expression: 'z' },
    ],
  };
  const compiledPlan = compilePlan(plan);
  t.is(compiledPlan.jobs.a.previous, undefined);
  t.is(compiledPlan.jobs.b.previous, 'a');
  t.is(compiledPlan.jobs.c.previous, 'b');
});

test('should set previous job with 3 jobs and shorthand syntax', (t) => {
  const plan: ExecutionPlan = {
    start: 'a',
    jobs: [
      { id: 'c', expression: 'z' },
      { id: 'a', expression: 'x', next: 'b' },
      { id: 'b', expression: 'y', next: 'c' },
    ],
  };
  const compiledPlan = compilePlan(plan);
  t.is(compiledPlan.jobs.a.previous, undefined);
  t.is(compiledPlan.jobs.b.previous, 'a');
  t.is(compiledPlan.jobs.c.previous, 'b');
});

test('should auto generate ids for jobs', (t) => {
  const plan = {
    start: 'a',
    jobs: [{ expression: 'x' }, { expression: 'y' }],
  };
  const compiledPlan = compilePlan(plan);
  const ids = Object.keys(compiledPlan.jobs);
  t.truthy(ids[0]);
  t.truthy(ids[1]);
  t.assert(ids[0] !== ids[1]);
});

test('should convert jobs to an object with auto ids', (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      // silly use case but it doens't matter
      { expression: 'x' },
      { expression: 'y' },
    ],
  };
  const compiledPlan = compilePlan(plan);
  t.deepEqual(Object.keys(compiledPlan.jobs), ['job-1', 'job-2']);
});

test('should reset job ids for each call', (t) => {
  const plan: ExecutionPlan = {
    jobs: [{ expression: 'x' }],
  };
  const first = compilePlan(plan);
  t.is(first.jobs['job-1'].expression, 'x');

  const second = compilePlan(plan);
  t.is(second.jobs['job-1'].expression, 'x');
});

test('should set the start to jobs[0]', (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      { id: 'a', expression: 'x' },
      { id: 'b', expression: 'y' },
      { id: 'c', expression: 'z' },
    ],
  };
  const compiledPlan = compilePlan(plan);
  t.is(compiledPlan.start, 'a');
});

test('should not override the start', (t) => {
  const plan: ExecutionPlan = {
    start: 'c',
    jobs: [
      { id: 'a', expression: 'x' },
      { id: 'b', expression: 'y' },
      { id: 'c', expression: 'z' },
    ],
  };
  const compiledPlan = compilePlan(plan);
  t.is(compiledPlan.start, 'c');
});

test('should compile a shorthand edge', (t) => {
  const plan: ExecutionPlan = {
    start: 'a',
    jobs: [
      {
        id: 'a',
        expression: 'x',
        next: 'y',
      },
    ],
  };

  const compiledPlan = compilePlan(plan);

  t.deepEqual(compiledPlan.jobs.a.next!, {
    y: true,
  });
});

test('should not recompile a functional edge', (t) => {
  const plan = planWithEdge({
    // @ts-ignore typings don't technically like this
    condition: () => true,
  });

  const compiledPlan = compilePlan(plan);
  // @ts-ignore
  const result = compiledPlan.jobs.a.next!.b.condition({});
  t.true(result);
});

test('should compile a truthy edge', (t) => {
  const plan = planWithEdge({ condition: 'true' });

  const compiledPlan = compilePlan(plan);

  // @ts-ignore
  const result = compiledPlan.jobs.a.next!.b.condition({});
  t.true(result);
});

test('should compile a string edge', (t) => {
  const plan = planWithEdge('true');

  const compiledPlan = compilePlan(plan);

  // @ts-ignore
  const result = compiledPlan.jobs.a.next!.b.condition();
  t.true(result);
});

test('should compile a falsy edge', (t) => {
  const plan = planWithEdge({ condition: 'false' });

  const compiledPlan = compilePlan(plan);

  // @ts-ignore
  const result = compiledPlan.jobs.a.next!.b.condition({});
  t.false(result);
});

test('should compile an edge with arithmetic', (t) => {
  const plan = planWithEdge({ condition: '1 + 1' });

  const compiledPlan = compilePlan(plan);

  // @ts-ignore
  const result = compiledPlan.jobs.a.next!.b.condition({});
  t.is(result, 2);
});

test('should compile an edge which uses state', (t) => {
  const plan = planWithEdge({ condition: '!state.hasOwnProperty("error")' });

  const compiledPlan = compilePlan(plan);

  // @ts-ignore
  const result = compiledPlan.jobs.a.next!.b.condition({});
  t.true(result);
});

test('condition cannot require', (t) => {
  const plan = planWithEdge({ condition: 'require("axios")' });

  const compiledPlan = compilePlan(plan);

  // @ts-ignore
  t.throws(() => compiledPlan.jobs.a.next!.b.condition({ data: {} }), {
    message: 'require is not defined',
  });
});

test('condition cannot access process', (t) => {
  const plan = planWithEdge({ condition: 'process.exit()' });

  const compiledPlan = compilePlan(plan);

  // @ts-ignore
  t.throws(() => compiledPlan.jobs.a.next!.b.condition({ data: {} }), {
    message: 'process is not defined',
  });
});

test('condition cannot access process #2', (t) => {
  const plan = planWithEdge({ condition: '(() => process.exit())()' });

  const compiledPlan = compilePlan(plan);

  // @ts-ignore
  t.throws(() => compiledPlan.jobs.a.next!.b.condition({ data: {} }), {
    message: 'process is not defined',
  });
});

test('condition cannot eval', (t) => {
  const plan = planWithEdge({ condition: 'eval("process.exit()")' });

  const compiledPlan = compilePlan(plan);

  // @ts-ignore
  t.throws(() => compiledPlan.jobs.a.next!.b.condition({ data: {} }), {
    message: 'Code generation from strings disallowed for this context',
  });
});

test('throw for a syntax error on a job edge', (t) => {
  const plan = planWithEdge({ condition: '@£^!!' });

  try {
    compilePlan(plan);
  } catch (err: any) {
    t.regex(err.message, /failed to compile(.*)a->b/i);
  }
});

test('throw for multiple errors', (t) => {
  const plan = {
    jobs: [
      {
        id: 'a',
        expression: 'x',
        next: {
          b: {
            condition: '@£^!!',
          },
          c: {
            condition: '@£^!!',
          },
        },
      },
    ],
  };

  try {
    compilePlan(plan);
  } catch (e) {
    // the message will have have one error per line
    const { message } = e;
    const lines = message.split('\n\n');
    t.is(lines.length, 2);
  }
});
