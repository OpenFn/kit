import test from 'ava';
import { createMockLogger } from '@openfn/logger';
import { ExecutionPlan, JobNode } from '../../src/types';
import execute from './../../src/execute/plan';

const opts = {};
const logger = createMockLogger();

const executePlan = (plan: ExecutionPlan, state = {}, options = opts) =>
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

test('report an error for a plam which references an undefined job', async (t) => {
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

test('report an error for an illegal precondition', async (t) => {
  const plan: ExecutionPlan = {
    precondition: '!!!!',
    jobs: {},
  };
  const result = await executePlan(plan);
  t.assert(result.hasOwnProperty('error'));
  t.regex(result.error.message, /failed to compile plan precondition/i);
});

test('report an error for an edge condition', async (t) => {
  const plan: ExecutionPlan = {
    jobs: {
      a: {
        next: {
          b: {
            condition: '!!!!',
          },
        },
      },
      b: {},
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
  const result = await executePlan(plan);
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
  const result = await executePlan(plan, { data: { x: 33 } });
  t.is(result, 33);
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

// Not sure this is correct at all!!
test('inline state overwrites initial state', async (t) => {
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
  t.is(result.data.x, 11);
});

test('inline state overwrites initial state on the second job', async (t) => {
  const plan: ExecutionPlan = {
    start: 'job1',
    jobs: {
      job1: {
        expression: 'export default [s => s]',
        next: { job2: true },
      },
      job2: {
        expression: 'export default [s => s]',
        data: { x: 11 },
      },
    },
  };
  const result = await executePlan(plan, { data: { x: 33 } });
  t.is(result.data?.x, 11);
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

// TODO precondition true
// TODO precondition false
// TODO run multiple edges
// TODO run no edges
// TODO don't call { acceptError: false } on error
// TODO do call { acceptError: false } on success
// TODO trap errors

// Redundant at the moment
test.skip('follow a string upstream pointer', () => {});

test.skip('follow a default upstream pointer', () => {});

test.skip('follow an onSuccess upstream pointer', () => {});

test.skip('follow an onError upstream pointer', () => {});

test.skip('pass input state to the first job', () => {});

test.skip('forward state to the second job', () => {});

test.skip('assemble state and credentials', () => {});

// error handling?
