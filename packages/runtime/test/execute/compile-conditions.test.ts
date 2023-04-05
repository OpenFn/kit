import test from 'ava';

import compileConditions from '../../src/execute/compile-conditions';

test('should not recompile a functional precondition', (t) => {
  const plan = {
    precondition: function () {
      return true;
    },
    jobs: {},
  };

  const compiledPlan = compileConditions(plan);

  const result = compiledPlan.precondition({});
  t.true(result);
});

test('should compile a truthy precondition', (t) => {
  const plan = {
    precondition: 'true',
    jobs: {},
  };

  const compiledPlan = compileConditions(plan);

  const result = compiledPlan.precondition({});
  t.true(result);
});

test('should compile a falsy precondition', (t) => {
  const plan = {
    precondition: 'false',
    jobs: {},
  };

  const compiledPlan = compileConditions(plan);

  const result = compiledPlan.precondition({});
  t.false(result);
});

test('should compile a precondition with arithmetic', (t) => {
  const plan = {
    precondition: '1 + 1',
    jobs: {},
  };

  const compiledPlan = compileConditions(plan);

  const result = compiledPlan.precondition({});
  t.is(result, 2);
});

test('should compile a precondition which uses state', (t) => {
  const plan = {
    precondition: '!state.hasOwnProperty("error")',
    jobs: {},
  };

  const compiledPlan = compileConditions(plan);

  const result = compiledPlan.precondition({ data: {} });
  t.true(result);
});

test('precondition cannot require', (t) => {
  const plan = {
    precondition: 'require("axios")',
    jobs: {},
  };

  const compiledPlan = compileConditions(plan);

  t.throws(() => compiledPlan.precondition({ data: {} }), {
    message: 'require is not defined',
  });
});

test('precondition cannot access process', (t) => {
  const plan = {
    precondition: 'process.exit()',
    jobs: {},
  };

  const compiledPlan = compileConditions(plan);

  t.throws(() => compiledPlan.precondition({ data: {} }), {
    message: 'process is not defined',
  });
});

test('precondition cannot access process #2', (t) => {
  const plan = {
    precondition: '(() => process.exit())()',
    jobs: {},
  };

  const compiledPlan = compileConditions(plan);

  t.throws(() => compiledPlan.precondition({ data: {} }), {
    message: 'process is not defined',
  });
});

test('precondition cannot eval', (t) => {
  const plan = {
    precondition: 'eval("process.exit()")',
    jobs: {},
  };

  const compiledPlan = compileConditions(plan);

  t.throws(() => compiledPlan.precondition({ data: {} }), {
    message: 'Code generation from strings disallowed for this context',
  });
});

// The same code compiles preconditions and edges so we don't need to test the conditions too thoroughly
test('should compile an edge condition', (t) => {
  const plan = {
    jobs: {
      a: {
        next: {
          b: {
            condition: 'state.x === 10',
          },
        },
      },
    },
  };

  const compiledPlan = compileConditions(plan);

  const result = compiledPlan.jobs.a.next.b.condition({ x: 10 });
  t.true(result);
});

test('should compile a falsy edge condition', (t) => {
  const plan = {
    jobs: {
      a: {
        next: {
          b: {
            condition: 'false',
          },
        },
      },
    },
  };

  const compiledPlan = compileConditions(plan);

  const result = compiledPlan.jobs.a.next.b.condition({ x: 10 });
  t.false(result);
});

test('should not recompile a functional edge condition', (t) => {
  const plan = {
    jobs: {
      a: {
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

  const compiledPlan = compileConditions(plan);

  const result = compiledPlan.jobs.a.next.b.condition({ x: 10 });
  t.false(result);
});

test('edge condition should not eval', (t) => {
  const plan = {
    jobs: {
      a: {
        next: {
          b: {
            condition: 'eval("process.exit()")',
          },
        },
      },
    },
  };

  const compiledPlan = compileConditions(plan);

  t.throws(() => compiledPlan.jobs.a.next.b.condition({ x: 10 }), {
    message: 'Code generation from strings disallowed for this context',
  });
});
