import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';
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

test('run a workflow and notify major events', async (t) => {
  const counts: Record<string, number> = {};
  const notify = (name: string) => {
    if (!counts[name]) {
      counts[name] = 0;
    }
    counts[name] += 1;
  };

  const callbacks = {
    notify,
  };

  const plan: ExecutionPlan = {
    jobs: [{ expression: 'export default [(s) => s]' }],
  };

  await run(plan, {}, { callbacks });

  t.is(counts['init-start'], 1);
  t.is(counts['init-complete'], 1);
  t.is(counts['job-start'], 1);
  t.is(counts['job-complete'], 1);
});

test('resolve a credential', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression: 'export default [(s) => s]',
        configuration: 'ccc',
      },
    ],
  };

  const options = {
    strict: false,
    deleteConfiguration: false,
    callbacks: {
      resolveCredential: async () => ({ password: 'password1' }),
    },
  };

  const result: any = await run(plan, {}, options);
  t.truthy(result);
  t.deepEqual(result.configuration, { password: 'password1' });
});

test.todo('resolve intial state');

test('resolve initial state', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression: 'export default [(s) => s]',
        state: 'abc',
      },
    ],
  };

  const options = {
    callbacks: {
      resolveState: async () => ({ data: { foo: 'bar' } }),
    },
  };

  const result: any = await run(plan, {}, options);
  t.truthy(result);
  t.deepEqual(result.data, { foo: 'bar' });
});

test('run a workflow with two jobs and call callbacks', async (t) => {
  const counts: Record<string, number> = {};
  const notify = (name: string) => {
    if (!counts[name]) {
      counts[name] = 0;
    }
    counts[name] += 1;
  };

  const callbacks = {
    notify,
  };

  const plan: ExecutionPlan = {
    jobs: [
      { id: 'a', expression: 'export default [(s) => s]', next: { b: true } },
      { id: 'b', expression: 'export default [(s) => s]' },
    ],
  };

  await run(plan, {}, { callbacks });

  t.is(counts['init-start'], 2);
  t.is(counts['init-complete'], 2);
  t.is(counts['job-start'], 2);
  t.is(counts['job-complete'], 2);
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
  t.deepEqual(result, {
    b: {
      data: {
        count: 2,
        a: true,
        b: true,
      },
    },
    c: {
      data: {
        count: 2,
        a: true,
        c: true,
      },
    },
  });
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

test('run a workflow with a trigger node', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        next: { b: { condition: 'state.data.age > 18 ' } },
      },
      {
        id: 'b',
        expression: 'export default [(s) => { s.data.done = true ; return s}]',
      },
    ],
  };

  const result: any = await run(plan, { data: { age: 28 } });
  t.true(result.data.done);
});

test('prefer initial state to inline state', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        state: {
          data: {
            x: 20, // this will be overriden by the incoming state
            y: 20, // This will be untouched
          },
        },
        expression: 'export default [(s) => s]',
      },
    ],
  };

  const result: any = await run(plan, { data: { x: 40 } });
  t.is(result.data.x, 40);
  t.is(result.data.y, 20);
});

test('do not pass extraneous state in strict mode', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression: 'export default [() => ({ x: 1, data: {}} )]',
      },
    ],
  };

  const result: any = await run(plan, {}, { strict: true });
  t.deepEqual(result, {
    data: {},
  });
});

test('do pass extraneous state in non-strict mode', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        expression: 'export default [() => ({ x: 1, data: {}} )]',
      },
    ],
  };

  const result: any = await run(plan, {}, { strict: false });
  t.deepEqual(result, {
    x: 1,
    data: {},
  });
});

test('Allow a job to return undefined', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [{ expression: 'export default [() => {}]' }],
  };

  const result: any = await run(plan);
  t.falsy(result);
});

test('log errors, write to state, and continue', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        id: 'a',
        expression: 'export default [() => { throw new Error("test") }]',
        next: { b: true },
      },
      {
        id: 'b',
        expression: 'export default [(s) => { s.x = 1; return s; }]',
      },
    ],
  };

  const logger = createMockLogger();
  const result: any = await run(plan, {}, { strict: false, logger });
  t.is(result.x, 1);

  t.truthy(result.errors);
  t.is(result.errors.a.message, 'test');
  t.is(result.errors.a.name, 'UserError');

  t.truthy(logger._find('error', /failed job a/i));
});

test('error reports can be overwritten', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        id: 'a',
        expression: 'export default [() => { throw new Error("test") }]',
        next: { b: true },
      },
      {
        id: 'b',
        expression: 'export default [(s) => ({ errors: 22 })]',
      },
    ],
  };

  const logger = createMockLogger();
  const result: any = await run(plan, {}, { strict: false, logger });

  t.is(result.errors, 22);
});

// This tracks current behaviour but I don't know if it's right
test('stuff written to state before an error is preserved', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        id: 'a',
        data: { x: 0 },
        expression:
          'export default [(s) => { s.x = 1; throw new Error("test") }]',
      },
    ],
  };

  const logger = createMockLogger();
  const result: any = await run(plan, {}, { strict: false, logger });

  t.is(result.x, 1);
});

test('data can be an array (expression)', async (t) => {
  const expression = 'export default [() => ({ data: [1,2,3] })]';

  const result: any = await run(expression, {}, { strict: false });
  t.deepEqual(result.data, [1, 2, 3]);
});

test('data can be an array (workflow)', async (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        id: 'a',
        expression: 'export default [() => ({ data: [1,2,3] })]',
        next: 'b',
      },
      {
        id: 'b',
        expression: 'export default [(s) => s]',
      },
    ],
  };

  const result: any = await run(plan, {}, { strict: false });
  t.deepEqual(result.data, [1, 2, 3]);
});

test('import from a module', async (t) => {
  const expression = `
  import { x } from 'x';
  export default [(s) => ({ data: x })];
  `;

  const result = await run(
    expression,
    {},
    {
      linker: {
        modules: {
          x: { path: path.resolve('test/__modules__/test') },
        },
      },
    }
  );

  t.is(result.data, 'test');
});
