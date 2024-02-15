import test from 'ava';
import { ExecutionPlan, StepEdge } from '@openfn/lexicon';

import compilePlan from '../../src/execute/compile-plan';

const testPlan: ExecutionPlan = {
  workflow: {
    steps: [
      { id: 'a', expression: 'x', name: 'a', next: { b: true } },
      { id: 'b', expression: 'y' },
    ],
  },
  options: {
    start: 'a',
  },
};

const planWithEdge = (edge: Partial<StepEdge>) => ({
  workflow: {
    steps: [
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
      steps: [{ id: 'a', expression: 'a' }],
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
      steps: [{ id: 'a', expression: 'a' }],
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

test('should convert steps to an object', (t) => {
  const { workflow } = compilePlan(testPlan);
  t.deepEqual(workflow.steps.a, {
    id: 'a',
    name: 'a',
    expression: 'x',
    next: { b: true },
    previous: undefined,
  });

  t.truthy(workflow.steps.b);
  t.is(workflow.steps.b.expression, 'y');
});

test('should set previous job with 2 steps', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        { id: 'a', expression: 'x', next: { b: true } },
        { id: 'b', expression: 'y' },
      ],
    },
    options: {},
  };
  const { workflow } = compilePlan(plan);
  t.is(workflow.steps.a.previous, undefined);
  t.is(workflow.steps.b.previous, 'a');
});

test('should set previous job with 2 steps and shorthand syntax', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        { id: 'a', expression: 'x', next: 'b' },
        { id: 'b', expression: 'y' },
      ],
    },
    options: {},
  };
  const { workflow } = compilePlan(plan);
  t.is(workflow.steps.a.previous, undefined);
  t.is(workflow.steps.b.previous, 'a');
});

test('should set previous job with 2 steps and no start', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        { id: 'a', expression: 'x', next: { b: true } },
        { id: 'b', expression: 'y' },
      ],
    },
    options: {},
  };
  const { workflow } = compilePlan(plan);
  t.is(workflow.steps.a.previous, undefined);
  t.is(workflow.steps.b.previous, 'a');
});

test('should set previous job with 3 steps', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        { id: 'a', expression: 'x', next: { b: true } },
        { id: 'b', expression: 'y', next: { c: true } },
        { id: 'c', expression: 'z' },
      ],
    },
    options: {},
  };
  const { workflow } = compilePlan(plan);
  t.is(workflow.steps.a.previous, undefined);
  t.is(workflow.steps.b.previous, 'a');
  t.is(workflow.steps.c.previous, 'b');
});

test('should set previous job with 3 steps and shorthand syntax', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        { id: 'c', expression: 'z' },
        { id: 'a', expression: 'x', next: 'b' },
        { id: 'b', expression: 'y', next: 'c' },
      ],
    },
    options: {},
  };
  const { workflow } = compilePlan(plan);
  t.is(workflow.steps.a.previous, undefined);
  t.is(workflow.steps.b.previous, 'a');
  t.is(workflow.steps.c.previous, 'b');
});

test('should auto generate ids for steps', (t) => {
  const plan = {
    workflow: {
      steps: [{ expression: 'x' }, { expression: 'y' }],
    },
    options: {},
  };
  const { workflow } = compilePlan(plan);
  const ids = Object.keys(workflow.steps);
  t.truthy(ids[0]);
  t.truthy(ids[1]);
  t.assert(ids[0] !== ids[1]);
});

test('should convert steps to an object with auto ids', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [{ expression: 'x' }, { expression: 'y' }],
    },
    options: {},
  };
  const { workflow } = compilePlan(plan);
  t.deepEqual(Object.keys(workflow.steps), ['job-1', 'job-2']);
});

test('should reset job ids for each call', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [{ expression: 'x' }],
    },
    options: {},
  };
  const first = compilePlan(plan);
  t.is(first.workflow.steps['job-1'].expression, 'x');

  const second = compilePlan(plan);
  t.is(second.workflow.steps['job-1'].expression, 'x');
});

test('should set the start to steps[0]', (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
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
      steps: [
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
      steps: [
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

  t.deepEqual(workflow.steps.a.next!, {
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
  const result = workflow.steps.a.next!.b.condition({});
  t.true(result);
});

test('should compile a truthy edge', (t) => {
  const plan = planWithEdge({ condition: 'true' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  const result = workflow.steps.a.next!.b.condition({});
  t.true(result);
});

test('should compile a string edge', (t) => {
  const plan = planWithEdge('true');

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  const result = workflow.steps.a.next!.b.condition();
  t.true(result);
});

test('should compile a falsy edge', (t) => {
  const plan = planWithEdge({ condition: 'false' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  const result = workflow.steps.a.next!.b.condition({});
  t.false(result);
});

test('should compile an edge with arithmetic', (t) => {
  const plan = planWithEdge({ condition: '1 + 1' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  const result = workflow.steps.a.next!.b.condition({});
  t.is(result, 2);
});

test('should compile an edge which uses state', (t) => {
  const plan = planWithEdge({ condition: '!state.hasOwnProperty("error")' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  const result = workflow.steps.a.next!.b.condition({});
  t.true(result);
});

test('condition cannot require', (t) => {
  const plan = planWithEdge({ condition: 'require("axios")' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  t.throws(() => workflow.steps.a.next!.b.condition({ data: {} }), {
    message: 'require is not defined',
  });
});

test('condition cannot access process', (t) => {
  const plan = planWithEdge({ condition: 'process.exit()' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  t.throws(() => workflow.steps.a.next!.b.condition({ data: {} }), {
    message: 'process is not defined',
  });
});

test('condition cannot access process #2', (t) => {
  const plan = planWithEdge({ condition: '(() => process.exit())()' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  t.throws(() => workflow.steps.a.next!.b.condition({ data: {} }), {
    message: 'process is not defined',
  });
});

test('condition cannot eval', (t) => {
  const plan = planWithEdge({ condition: 'eval("process.exit()")' });

  const { workflow } = compilePlan(plan);

  // @ts-ignore
  t.throws(() => workflow.steps.a.next!.b.condition({ data: {} }), {
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
      steps: [
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
