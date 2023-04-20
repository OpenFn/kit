import test from 'ava';
import { ExecutionPlan } from '../src';
import run from '../src/runtime';

// High level examples of runtime usages

test('run simple expression', async (t) => {
  const expression = 'export default [(s) => {s.data.done = true; return s}]';

  const result: any = await run(expression);
  t.true(result.data.done);
});

test('run a simple workflow', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      { expression: 'export default [(s) => ({ data: { done: true } })]' },
    ],
  };

  const result: any = await run(plan);
  t.true(result.data.done);
});

test('run a workflow with state and parallel branching', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression:
          'export default [(s) => { s.data.count += 1; s.data.a = true; return s}]',
        next: {
          b: true as const,
          c: true as const,
        },
      },
      {
        id: 'b',
        expression:
          'export default [(s) => { s.data.count += 1; s.data.b = true; return s}]',
      },
      {
        id: 'c',
        expression:
          'export default [(s) => { s.data.count += 1; s.data.c = true; return s}]',
      },
    ],
  };

  const result: any = await run(plan, { data: { count: 0 } });
  t.true(result.data.a);
  t.true(result.data.b);
  t.true(result.data.c);
  t.is(result.data.count, 3);
});

test('run a workflow with state and conditional branching', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression: 'export default [(s) => { s.data.a = true; return s}]',
        next: {
          b: {
            condition: 'state.data.count > 0',
          },
          c: {
            condition: 'state.data.count == 0',
          },
        },
      },
      {
        id: 'b',
        expression: 'export default [(s) => { s.data.b = true; return s}]',
      },
      {
        id: 'c',
        expression: 'export default [(s) => { s.data.c = true; return s}]',
      },
    ],
  };

  const result1: any = await run(plan, { data: { count: 10 } });
  t.true(result1.data.a);
  t.true(result1.data.b);
  t.falsy(result1.data.c);
  t.is(result1.data.count, 10);

  const result2: any = await run(plan, { data: { count: 0 } });
  t.true(result2.data.a);
  t.falsy(result2.data.b);
  t.true(result2.data.c);
  t.is(result2.data.count, 0);
});

test('run a workflow with initial state and optional start', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        // won't run
        id: 'a',
        expression: 'export default [(s) => { s.data.count +=1 ; return s}]',
        next: { b: true },
      },
      {
        id: 'b',
        expression: 'export default [(s) => { s.data.count +=1 ; return s}]',
        next: { c: true },
      },
      {
        id: 'c',
        expression: 'export default [(s) => { s.data.count +=1 ; return s}]',
      },
    ],
  };

  const result: any = await run(plan, { data: { count: 10 } }, { start: 'b' });
  t.is(result.data.count, 12);
});
