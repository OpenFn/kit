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
  t.falsy(compiledPlan.jobs.a.id);
  t.is(compiledPlan.jobs.a.expression, 'x');

  t.truthy(compiledPlan.jobs.b);
  t.falsy(compiledPlan.jobs.b.id);
  t.is(compiledPlan.jobs.b.expression, 'y');
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
    y: {},
  });
});

test('should not recompile a functional edge', (t) => {
  const plan = planWithEdge({
    // @ts-ignore typings don't technically like this
    condition: () => true,
  });

  const compiledPlan = compilePlan(plan);
  const result = compiledPlan.jobs.a.next!.b.condition?.({});
  t.true(result);
});

test('should compile a truthy edge', (t) => {
  const plan = planWithEdge({ condition: 'true' });

  const compiledPlan = compilePlan(plan);

  const result = compiledPlan.jobs.a.next!.b.condition?.({});
  t.true(result);
});

test('should compile a falsy edge', (t) => {
  const plan = planWithEdge({ condition: 'false' });

  const compiledPlan = compilePlan(plan);

  const result = compiledPlan.jobs.a.next!.b.condition?.({});
  t.false(result);
});

test('should compile an edge with arithmetic', (t) => {
  const plan = planWithEdge({ condition: '1 + 1' });

  const compiledPlan = compilePlan(plan);

  const result = compiledPlan.jobs.a.next!.b.condition?.({});
  t.is(result, 2);
});

test('should compile an edge which uses state', (t) => {
  const plan = planWithEdge({ condition: '!state.hasOwnProperty("error")' });

  const compiledPlan = compilePlan(plan);

  const result = compiledPlan.jobs.a.next!.b.condition?.({});
  t.true(result);
});

test('condition cannot require', (t) => {
  const plan = planWithEdge({ condition: 'require("axios")' });

  const compiledPlan = compilePlan(plan);

  t.throws(() => compiledPlan.jobs.a.next!.b.condition?.({ data: {} }), {
    message: 'require is not defined',
  });
});

test('condition cannot access process', (t) => {
  const plan = planWithEdge({ condition: 'process.exit()' });

  const compiledPlan = compilePlan(plan);

  t.throws(() => compiledPlan.jobs.a.next!.b.condition?.({ data: {} }), {
    message: 'process is not defined',
  });
});

test('condition cannot access process #2', (t) => {
  const plan = planWithEdge({ condition: '(() => process.exit())()' });

  const compiledPlan = compilePlan(plan);

  t.throws(() => compiledPlan.jobs.a.next!.b.condition?.({ data: {} }), {
    message: 'process is not defined',
  });
});

test('condition cannot eval', (t) => {
  const plan = planWithEdge({ condition: 'eval("process.exit()")' });

  const compiledPlan = compilePlan(plan);

  t.throws(() => compiledPlan.jobs.a.next!.b.condition?.({ data: {} }), {
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
