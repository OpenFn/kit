import test from 'ava';
import { createMockLogger } from '@openfn/logger';
import { ExecutionPlan, JobPlan } from '../../src/types';
import execute from './../../src/execute/plan';

const opts = {};
const logger = createMockLogger();

const executePlan = (plan: ExecutionPlan, state = {}, options = opts) =>
  execute(plan, state, options, logger);

test('execute a one-job execution plan with inline state', async (t) => {
  const plan = {
    jobs: [
      // TODO accept a string expression as a shorthand
      {
        expression: 'export default [s => s.data.x]',
        data: { x: 22 }, // this all feels a bit wierd
      },
    ],
  };
  const result = await executePlan(plan);
  t.is(result, 22);
});

test('execute a one-job execution plan with initial state', async (t) => {
  const plan = {
    jobs: [
      {
        expression: 'export default [s => s.data.x]',
      },
    ],
  };
  const result = await executePlan(plan, { data: { x: 33 } });
  t.is(result, 33);
});

test('execute a two-job execution plan', async (t) => {
  const plan = {
    jobs: [
      {
        id: 1,
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
        // TODO for now we always need an explicit upstream
        // Otherwise it's too hard to know when to next or return
        upstream: 2,
      },
      {
        id: 2,
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
    ],
  };
  const result = await executePlan(plan, { data: { x: 0 } });
  t.is(result.data.x, 2);
});

// This tests current behaviour but I'm not sure we want to keep it...
// If I'd written this as as human I'd expect it to run through the whole array.
test('Return the result of the first expression without an upstream', async (t) => {
  const plan = {
    jobs: [
      {
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
      {
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
    ],
  };
  const result = await executePlan(plan, { data: { x: 0 } });
  t.is(result.data.x, 1);
});

test.skip('execute a two-job execution plan from job 2', () => {});

test('execute a 5 job execution plan', async (t) => {
  const plan = {
    jobs: [] as JobPlan[],
  };
  for (let i = 1; i < 6; i++) {
    plan.jobs.push({
      id: `${i}`,
      expression: 'export default [s => { s.data.x += 1; return s; } ]',
      upstream: i === 5 ? null : `${i + 1}`,
    } as JobPlan);
  }
  const result = await executePlan(plan, { data: { x: 0 } });
  t.is(result.data.x, 5);
});

// Redundant at the moment
test.skip('follow a string upstream pointer', () => {});

test.skip('follow a default upstream pointer', () => {});

test.skip('follow an onSuccess upstream pointer', () => {});

test.skip('follow an onError upstream pointer', () => {});

test.skip('pass input state to the first job', () => {});

test.skip('forward state to the second job', () => {});

test.skip('assemble state and credentials', () => {});

// error handling?
