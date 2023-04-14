import test from 'ava';
import run from '../src/runtime';

// High level examples of runtime usages

test('run simple expression', async (t) => {
  const expression = 'export default [(s) => {s.data.done = true; return s}]';

  const result: any = await run(expression);
  t.true(result.data.done);
});

test('run a simple workflow', async (t) => {
  const plan = {
    start: 'test-job',
    jobs: {
      'test-job': {
        expression: 'export default [(s) => {s.data.done = true; return s}]',
      },
    },
  };

  const result: any = await run(plan);
  t.true(result.data.done);
});

test('run a workflow with state and parallel branching', async (t) => {
  const plan = {
    start: 'a',
    jobs: {
      a: {
        expression:
          'export default [(s) => { s.data.count += 1; s.data.a = true; return s}]',
        next: {
          b: true as const,
          c: true as const,
        },
      },
      b: {
        expression:
          'export default [(s) => { s.data.count += 1; s.data.b = true; return s}]',
      },
      c: {
        expression:
          'export default [(s) => { s.data.count += 1; s.data.c = true; return s}]',
      },
    },
  };

  const result: any = await run(plan, { data: { count: 0 } });
  t.true(result.data.a);
  t.true(result.data.b);
  t.true(result.data.c);
  t.is(result.data.count, 3);
});

test('run a workflow with state and conditional branching', async (t) => {
  const plan = {
    start: 'a',
    jobs: {
      a: {
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
      b: {
        expression: 'export default [(s) => { s.data.b = true; return s}]',
      },
      c: {
        expression: 'export default [(s) => { s.data.c = true; return s}]',
      },
    },
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
