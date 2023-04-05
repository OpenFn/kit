import test from 'ava';
import { createMockLogger } from '@openfn/logger';
import { ExecutionPlan, JobNode } from '../../src/types';
import execute from './../../src/execute/plan';

const opts = {};
const logger = createMockLogger();

const executePlan = (plan: ExecutionPlan, state = {}, options = opts) =>
  execute(plan, state, options, logger);

test('execute a one-job execution plan with inline state', async (t) => {
  const plan = {
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
  const plan = {
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

test('execute a two-job execution plan', async (t) => {
  const plan = {
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
  const plan = {
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
  t.is(result.data.x, 1);
});

test.skip('execute a two-job execution plan from job 2', () => {});

test('execute a 5 job execution plan', async (t) => {
  const plan = {
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
