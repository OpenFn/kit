import test from 'ava';

import compilePlan from '../../src/execute/compile-plan';

const testPlan = {
  start: 'a',
  jobs: { a: { expression: 'x' } },
};

test('should compile a shorthand start edge', (t) => {
  const plan = {
    ...testPlan,
    start: 'a',
  };

  const compiledPlan = compilePlan(plan);

  t.deepEqual(compiledPlan.start, {
    a: {},
  });
});

test('should compile a shorthand job edge', (t) => {
  const plan = {
    start: 'a',
    jobs: {
      a: {
        expression: 'x',
        next: 'y',
      },
    },
  };

  const compiledPlan = compilePlan(plan);

  t.deepEqual(compiledPlan.jobs.a.next!, {
    y: {},
  });
});

test('should not recompile a functional start condition', (t) => {
  const plan = {
    ...testPlan,
    start: {
      a: {
        condition: () => true,
      },
    },
  };

  // @ts-ignore typings don't like uncompiled plans having functions
  const compiledPlan = compilePlan(plan);
  const result = compiledPlan.start.a.condition?.({});
  t.true(result);
});

test('should compile a truthy start condition', (t) => {
  const plan = {
    ...testPlan,
    start: { a: { condition: 'true' } },
  };

  const compiledPlan = compilePlan(plan);

  const result = compiledPlan.start.a.condition?.({});
  t.true(result);
});

test('should compile a falsy start condition', (t) => {
  const plan = {
    ...testPlan,
    start: { a: { condition: 'false' } },
  };

  const compiledPlan = compilePlan(plan);

  const result = compiledPlan.start.a.condition?.({});
  t.false(result);
});

test('should compile a start condition with arithmetic', (t) => {
  const plan = {
    ...testPlan,
    start: { a: { condition: '1 + 1' } },
  };

  const compiledPlan = compilePlan(plan);

  const result = compiledPlan.start.a.condition?.({});
  t.is(result, 2);
});

test('should compile a start condition which uses state', (t) => {
  const plan = {
    ...testPlan,
    start: { a: { condition: '!state.hasOwnProperty("error")' } },
  };

  const compiledPlan = compilePlan(plan);

  const result = compiledPlan.start.a.condition?.({ data: {} });
  t.true(result);
});

// Edge conditions should behave exactly the same on edges as start... but here's a few tests to be sure

test('should compile an edge condition', (t) => {
  const plan = {
    ...testPlan,
    jobs: {
      a: {
        expression: 'x',
        next: {
          b: {
            condition: 'state.x === 10',
          },
        },
      },
    },
  };

  const compiledPlan = compilePlan(plan);

  const result = compiledPlan.jobs.a.next!.b.condition?.({ x: 10 });
  t.true(result);
});

test('should compile a falsy edge condition', (t) => {
  const plan = {
    ...testPlan,
    jobs: {
      a: {
        expression: 'x',
        next: {
          b: {
            condition: 'false',
          },
        },
      },
    },
  };

  const compiledPlan = compilePlan(plan);

  const result = compiledPlan.jobs.a.next!.b.condition?.({ x: 10 });
  t.false(result);
});

test('should not recompile a functional edge condition', (t) => {
  const plan = {
    ...testPlan,
    jobs: {
      a: {
        expression: 'x',
        next: {
          b: {
            condition: function () {
              return false;
            },
          },
        },
      },
    },
  };

  // @ts-ignore typesing don't like a function being passed in an uncompiled job (fair enough really)
  const compiledPlan = compilePlan(plan);

  const result = compiledPlan.jobs.a.next!.b.condition?.({ x: 10 });
  t.false(result);
});

test('condition cannot require', (t) => {
  const plan = {
    ...testPlan,
    start: { a: { condition: 'require("axios")' } },
  };

  const compiledPlan = compilePlan(plan);

  t.throws(() => compiledPlan.start.a.condition?.({ data: {} }), {
    message: 'require is not defined',
  });
});

test('condition cannot access process', (t) => {
  const plan = {
    ...testPlan,
    start: { a: { condition: 'process.exit()' } },
  };

  const compiledPlan = compilePlan(plan);

  t.throws(() => compiledPlan.start.a.condition?.({ data: {} }), {
    message: 'process is not defined',
  });
});

test('condition cannot access process #2', (t) => {
  const plan = {
    ...testPlan,
    start: { a: { condition: '(() => process.exit())()' } },
  };

  const compiledPlan = compilePlan(plan);

  t.throws(() => compiledPlan.start.a.condition?.({ data: {} }), {
    message: 'process is not defined',
  });
});

test('condition cannot eval', (t) => {
  const plan = {
    ...testPlan,
    start: { a: { condition: 'eval("process.exit()")' } },
  };

  const compiledPlan = compilePlan(plan);

  t.throws(() => compiledPlan.start.a.condition?.({ data: {} }), {
    message: 'Code generation from strings disallowed for this context',
  });
});

// Just a sanity check
test('edge condition should not eval', (t) => {
  const plan = {
    ...testPlan,
    jobs: {
      a: {
        expression: 'x',
        next: {
          b: {
            condition: 'eval("process.exit()")',
          },
        },
      },
    },
  };

  const compiledPlan = compilePlan(plan);

  t.throws(() => compiledPlan.jobs.a.next!.b.condition?.({ x: 10 }), {
    message: 'Code generation from strings disallowed for this context',
  });
});

test('throw for a syntax error on a start edge', (t) => {
  const plan = {
    ...testPlan,
    start: {
      a: {
        condition: '@£^!!',
      },
    },
  };

  try {
    compilePlan(plan);
  } catch (errors: any) {
    t.true(Array.isArray(errors));
    t.is(errors.length, 1);
    const err = errors[0];
    t.regex(err.message, /failed to compile(.*)start->a/i);
  }
});

test('throw for a syntax error on a job edge', (t) => {
  const plan = {
    ...testPlan,
    jobs: {
      a: {
        expression: 'x',
        next: {
          b: {
            condition: '@£^!!',
          },
        },
      },
    },
  };

  try {
    compilePlan(plan);
  } catch (errors: any) {
    t.true(Array.isArray(errors));
    t.is(errors.length, 1);
    const err = errors[0];
    t.regex(err.message, /failed to compile(.*)a->b/i);
  }
});

test('throw for a multiple errors', (t) => {
  const plan = {
    start: {
      a: {
        condition: '@£^!!',
      },
    },
    jobs: {
      a: {
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
    },
  };

  try {
    compilePlan(plan);
  } catch (errors: any) {
    t.true(Array.isArray(errors));
    t.is(errors.length, 3);
  }
});
