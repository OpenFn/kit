import test from 'ava';
import { ExecutionPlan, StepEdge } from '@openfn/lexicon';

import compilePlan from '../../src/execute/compile-plan';

const testPlan: ExecutionPlan = {
  workflow: {
    jobs: [
      { id: 'a', expression: 'x', next: { b: true } },
      { id: 'b', expression: 'y' },
    ],
  },
  options: {
    start: 'a',
  },
};

const planWithEdge = (edge: Partial<StepEdge>) => ({
  workflow: {
    jobs: [
      {
        id: 'a',
        expression: 'x',
        next: {
          b: edge,
        },
      },
      { id: 'b', expression: 'y' },
    ],
  },
  options: {
    start: 'a',
  },
});

test('should preserve the start option', (t) => {
  const compiledPlan = compilePlan({
    id: 'a',
    workflow: {
      jobs: [{ id: 'a', expression: 'a' }],
    },
    options: {
      start: 'a',
    },
  });

  t.is(compiledPlan.options.start, 'a');
});

test('should preserve arbitrary options', (t) => {
  const compiledPlan = compilePlan({
    id: 'a',
    workflow: {
      jobs: [{ id: 'a', expression: 'a' }],
    },
    options: {
      // @ts-ignore
      a: 1,
      z: 2,
      '-': 3,
    },
  });

  t.deepEqual(compiledPlan.options, {
    a: 1,
    z: 2,
    '-': 3,
    start: 'a',
  });
});

test('should convert jobs to an object', (t) => {
  const { workflow } = compilePlan(testPlan);
  t.truthy(workflow.jobs.a);
  t.is(workflow.jobs.a.expression, 'x');

  t.truthy(workflow.jobs.b);
  t.is(workflow.jobs.b.expression, 'y');
});

test('should set previous job with 2 jobs', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      jobs: [
        { id: 'a', expression: 'x', next: { b: true } },
        { id: 'b', expression: 'y' },
      ],
    },
    options: {},
  };
  const { workflow } = compilePlan(plan);
  t.is(workflow.jobs.a.previous, undefined);
  t.is(workflow.jobs.b.previous, 'a');
});

test('should set previous job with 2 jobs and shorthand syntax', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      jobs: [
        { id: 'a', expression: 'x', next: 'b' },
        { id: 'b', expression: 'y' },
      ],
    },
    options: {},
  };
  const { workflow } = compilePlan(plan);
  t.is(workflow.jobs.a.previous, undefined);
  t.is(workflow.jobs.b.previous, 'a');
});

test('should set previous job with 2 jobs and no start', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      jobs: [
        { id: 'a', expression: 'x', next: { b: true } },
        { id: 'b', expression: 'y' },
      ],
    },
    options: {},
  };
  const { workflow } = compilePlan(plan);
  t.is(workflow.jobs.a.previous, undefined);
  t.is(workflow.jobs.b.previous, 'a');
});

test('should set previous job with 3 jobs', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      jobs: [
        { id: 'a', expression: 'x', next: { b: true } },
        { id: 'b', expression: 'y', next: { c: true } },
        { id: 'c', expression: 'z' },
      ],
    },
    options: {},
  };
  const { workflow } = compilePlan(plan);
  t.is(workflow.jobs.a.previous, undefined);
  t.is(workflow.jobs.b.previous, 'a');
  t.is(workflow.jobs.c.previous, 'b');
});

test('should set previous job with 3 jobs and shorthand syntax', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      jobs: [
        { id: 'c', expression: 'z' },
        { id: 'a', expression: 'x', next: 'b' },
        { id: 'b', expression: 'y', next: 'c' },
      ],
    },
    options: {},
  };
  const { workflow } = compilePlan(plan);
  t.is(workflow.jobs.a.previous, undefined);
  t.is(workflow.jobs.b.previous, 'a');
  t.is(workflow.jobs.c.previous, 'b');
});

test('should auto generate ids for jobs', (t) => {
  const plan = {
    workflow: {
      jobs: [{ expression: 'x' }, { expression: 'y' }],
    },
    options: {},
  };
  const { workflow } = compilePlan(plan);
  const ids = Object.keys(workflow.jobs);
  t.truthy(ids[0]);
  t.truthy(ids[1]);
  t.assert(ids[0] !== ids[1]);
});

test('should convert jobs to an object with auto ids', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      jobs: [
        // silly use case but it doens't matter
        { expression: 'x' },
        { expression: 'y' },
      ],
    },
    options: {},
  };
  const { workflow } = compilePlan(plan);
  t.deepEqual(Object.keys(workflow.jobs), ['job-1', 'job-2']);
});

test('should reset job ids for each call', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      jobs: [{ expression: 'x' }],
    },
    options: {},
  };
  const first = compilePlan(plan);
  t.is(first.workflow.jobs['job-1'].expression, 'x');

  const second = compilePlan(plan);
  t.is(second.workflow.jobs['job-1'].expression, 'x');
});

test('should set the start to jobs[0]', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      jobs: [
        { id: 'a', expression: 'x' },
        { id: 'b', expression: 'y' },
        { id: 'c', expression: 'z' },
      ],
    },
    options: {},
  };
  const { options } = compilePlan(plan);
  t.is(options.start, 'a');
});

test('should not override the start', (t) => {
  const plan: ExecutionPlan = {
    options: {
      start: 'c',
    },
    workflow: {
      jobs: [
        { id: 'a', expression: 'x' },
        { id: 'b', expression: 'y' },
        { id: 'c', expression: 'z' },
      ],
    },
  };
  const { options } = compilePlan(plan);
  t.is(options.start, 'c');
});

test('should compile a shorthand edge', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      jobs: [
        {
          id: 'a',
          expression: 'x',
          next: 'y',
        },
      ],
    },
    options: {},
  };

  const { workflow } = compilePlan(plan);

  t.deepEqual(workflow.jobs.a.next!, {
    y: true,
  });
});

test('should not recompile a functional edge', (t) => {
  const plan = planWithEdge({
    // @ts-ignore typings don't technically like this
    condition: () => true,
  });

  const { workflow } = compilePlan(plan);
  // @ts-ignore
  const result = workflow.jobs.a.next!.b.condition({});
  t.true(result);
});

test('should compile a truthy edge', (t) => {
  const plan = planWithEdge({ condition: 'true' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  const result = workflow.jobs.a.next!.b.condition({});
  t.true(result);
});

test('should compile a string edge', (t) => {
  const plan = planWithEdge('true');

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  const result = workflow.jobs.a.next!.b.condition();
  t.true(result);
});

test('should compile a falsy edge', (t) => {
  const plan = planWithEdge({ condition: 'false' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  const result = workflow.jobs.a.next!.b.condition({});
  t.false(result);
});

test('should compile an edge with arithmetic', (t) => {
  const plan = planWithEdge({ condition: '1 + 1' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  const result = workflow.jobs.a.next!.b.condition({});
  t.is(result, 2);
});

test('should compile an edge which uses state', (t) => {
  const plan = planWithEdge({ condition: '!state.hasOwnProperty("error")' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  const result = workflow.jobs.a.next!.b.condition({});
  t.true(result);
});

test('condition cannot require', (t) => {
  const plan = planWithEdge({ condition: 'require("axios")' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  t.throws(() => workflow.jobs.a.next!.b.condition({ data: {} }), {
    message: 'require is not defined',
  });
});

test('condition cannot access process', (t) => {
  const plan = planWithEdge({ condition: 'process.exit()' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  t.throws(() => workflow.jobs.a.next!.b.condition({ data: {} }), {
    message: 'process is not defined',
  });
});

test('condition cannot access process #2', (t) => {
  const plan = planWithEdge({ condition: '(() => process.exit())()' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  t.throws(() => workflow.jobs.a.next!.b.condition({ data: {} }), {
    message: 'process is not defined',
  });
});

test('condition cannot eval', (t) => {
  const plan = planWithEdge({ condition: 'eval("process.exit()")' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  t.throws(() => workflow.jobs.a.next!.b.condition({ data: {} }), {
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
    workflow: {
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
    },
    options: {},
  };

  try {
    compilePlan(plan);
  } catch (e: any) {
    // the message will have have one error per line
    const { message } = e;
    const lines = message.split('\n\n');
    t.is(lines.length, 2);
  }
});
