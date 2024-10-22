import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';
import type { ExecutionPlan } from '@openfn/lexicon';

import {
  NOTIFY_INIT_COMPLETE,
  NOTIFY_JOB_COMPLETE,
  NOTIFY_JOB_ERROR,
  NOTIFY_JOB_START,
  NOTIFY_INIT_START,
} from '../src';
import run from '../src/runtime';

type ExecutionPlanNoOptions = Omit<ExecutionPlan, 'options'>;

test('run simple expression', async (t) => {
  const expression = 'export default [(s) => {s.data.done = true; return s}]';

  const result: any = await run(expression);
  t.true(result.data.done);
});

test('run a simple workflow', async (t) => {
  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
        { expression: 'export default [(s) => ({ data: { done: true } })]' },
      ],
    },
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

  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [{ expression: 'export default [(s) => s]' }],
    },
  };

  await run(plan, {}, { callbacks });

  t.is(counts[NOTIFY_INIT_START], 1);
  t.is(counts[NOTIFY_INIT_COMPLETE], 1);
  t.is(counts[NOTIFY_JOB_START], 1);
  t.is(counts[NOTIFY_JOB_COMPLETE], 1);
});

test('notify job error even after fail', async (t) => {
  const notify = (name: string, event: any) => {
    if (name === NOTIFY_JOB_ERROR) {
      t.is(event.jobId, 'a');
      t.true(!isNaN(event.duration));
      t.is(event.error.name, 'RuntimeError');
      t.is(event.error.subtype, 'TypeError');
      t.regex(event.error.message, /Cannot read properties of undefined/);
      t.pass('called job erorr');
    }
  };
  const callbacks = {
    notify,
  };

  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
        { id: 'a', expression: 'export default [(s) => s.data.x = s.err.z ]' },
      ],
    },
  };

  await run(plan, {}, { callbacks });
});

test('notify job error even after crash', async (t) => {
  const notify = (name: string, event: any) => {
    if (name === NOTIFY_JOB_ERROR) {
      t.is(event.jobId, 'a');
      t.true(!isNaN(event.duration));
      t.is(event.error.name, 'RuntimeCrash');
      t.is(event.error.subtype, 'ReferenceError');
      t.regex(event.error.message, /s is not defined/);
      t.pass('called job erorr');
    }
  };
  const callbacks = {
    notify,
  };

  const plan: ExecutionPlanNoOptions = {
    workflow: { steps: [{ id: 'a', expression: 'export default [() => s]' }] },
  };

  try {
    await run(plan, {}, { callbacks });
  } catch (e) {
    // this will throw, it's fine
    // don't assert on it, I only wnat to assert in on-error
  }
});

test('resolve a credential', async (t) => {
  const plan: Partial<ExecutionPlan> = {
    workflow: {
      steps: [
        {
          expression: 'export default [(s) => s]',
          configuration: 'ccc',
        },
      ],
    },
  };

  const options = {
    statePropsToRemove: [],
    callbacks: {
      resolveCredential: async () => ({ password: 'password1' }),
    },
  };

  const result: any = await run(plan, {}, options);
  t.truthy(result);
  t.deepEqual(result.configuration, { password: 'password1' });
});

test('resolve initial state', async (t) => {
  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
        {
          expression: 'export default [(s) => s]',
          state: 'abc',
        },
      ],
    },
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

  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
        { id: 'a', expression: 'export default [(s) => s]', next: { b: true } },
        { id: 'b', expression: 'export default [(s) => s]' },
      ],
    },
  };

  await run(plan, {}, { callbacks });

  t.is(counts['init-start'], 2);
  t.is(counts['init-complete'], 2);
  t.is(counts['job-start'], 2);
  t.is(counts['job-complete'], 2);
});

test('run a workflow with state and parallel branching', async (t) => {
  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
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
    },
  };

  const state = { data: { count: 0 } };

  const result: any = await run(plan, state);
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

test('run a workflow with a leaf step called multiple times', async (t) => {
  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
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
          next: { z: true },
        },
        {
          id: 'c',
          expression:
            'export default [(s) => { s.data.count += 1; s.data.c = true; return s}]',
          next: { z: true },
        },
        {
          id: 'z',
          expression: 'export default [(s) => s]',
        },
      ],
    },
  };

  const state = { data: { count: 0 } };

  const result: any = await run(plan, state);
  t.deepEqual(result, {
    z: {
      data: {
        count: 2,
        a: true,
        b: true,
      },
    },
    'z-1': {
      data: {
        count: 2,
        a: true,
        c: true,
      },
    },
  });
});

// TODO this test sort of shows why input state on the plan object is a bit funky
// running the same plan with two inputs is pretty clunky
test('run a workflow with state and conditional branching', async (t) => {
  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
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

test('run a workflow with initial state (data key) and optional start', async (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        {
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
    },
    options: {
      start: 'b',
    },
  };

  const result: any = await run(plan, { data: { count: 10 } });
  t.is(result.data.count, 12);
});

test('run a workflow with an end', async (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        {
          id: 'a',
          expression: 'export default [(s) => { s.data.a = 1 ; return s}]',
          next: { b: true },
        },
        {
          id: 'b',
          expression: 'export default [(s) => { s.data.b = 1; return s}]',
          next: { c: true },
        },
        {
          id: 'c',
          expression: 'export default [(s) => { s.data.c = 1 ; return s}]',
        },
      ],
    },
    options: {
      end: 'b',
    },
  };

  const result: any = await run(plan, {});
  t.deepEqual(result, { data: { a: 1, b: 1 } });
});

test('run a workflow with a start and end', async (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        {
          id: 'a',
          expression: 'export default [(s) => { s.data.a = 1 ; return s}]',
          next: { b: true },
        },
        {
          id: 'b',
          expression: 'export default [(s) => { s.data.b = 1; return s}]',
          next: { c: true },
        },
        {
          id: 'c',
          expression: 'export default [(s) => { s.data.c = 1 ; return s}]',
        },
      ],
    },
    options: {
      start: 'b',
      end: 'b',
    },
  };

  const result: any = await run(plan, {});
  t.deepEqual(result, { data: { b: 1 } });
});

test('run a workflow with a trigger node', async (t) => {
  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
        {
          next: { b: { condition: 'state.data.age > 18 ' } },
        },
        {
          id: 'b',
          expression:
            'export default [(s) => { s.data.done = true ; return s}]',
        },
      ],
    },
  };

  const result: any = await run(plan, { data: { age: 28 } });
  t.true(result.data.done);
});

test('prefer initial state to inline state', async (t) => {
  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
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
    },
  };

  const result: any = await run(plan, { data: { x: 40 } });
  t.is(result.data.x, 40);
  t.is(result.data.y, 20);
});

test('Allow a job to return undefined', async (t) => {
  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [{ expression: 'export default [() => {}]' }],
    },
  };

  const result: any = await run(plan);
  t.falsy(result);
});

test('log errors, write to state, and continue', async (t) => {
  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
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
    },
  };

  const logger = createMockLogger();
  const result: any = await run(plan, {}, { logger });
  t.is(result.x, 1);

  t.truthy(result.errors);
  t.deepEqual(result.errors.a, {
    source: 'runtime',
    name: 'JobError',
    severity: 'fail',
    message: 'test',
  });

  t.truthy(logger._find('error', /failed step a/i));
});

test('log job code to the job logger', async (t) => {
  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
        {
          id: 'a',
          expression: 'export default [(s) => { console.log("hi"); return s;}]',
        },
      ],
    },
  };

  const jobLogger = createMockLogger('JOB', { level: 'debug', json: true });
  await run(plan, {}, { jobLogger });

  t.is(jobLogger._history.length, 1);
  const [out] = jobLogger._history;

  t.is(out.level, 'info');
  t.is(out.message[0], 'hi');
});

test('log and serialize an error to the job logger', async (t) => {
  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
        {
          id: 'a',
          expression:
            'export default [(s) => { console.log(new Error("hi")); return s;}]',
        },
      ],
    },
  };

  const jobLogger = createMockLogger('JOB', { level: 'debug', json: true });
  await run(plan, {}, { jobLogger });

  t.is(jobLogger._history.length, 1);
  const [out] = jobLogger._history;
  t.log(out);

  t.is(out.level, 'info');
  t.is(out.message[0].name, 'Error');
  t.is(out.message[0].message, 'hi');
  // should not be an error instance
  t.falsy(out.message[0].stack);
});

test('error reports can be overwritten', async (t) => {
  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
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
    },
  };

  const logger = createMockLogger();
  const result: any = await run(plan, {}, { logger });

  t.is(result.errors, 22);
});

// This tracks current behaviour but I don't know if it's right
test('stuff written to state before an error is preserved', async (t) => {
  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
        {
          id: 'a',
          state: {
            data: { x: 0 },
          },
          expression:
            'export default [(s) => { s.x = 1; throw new Error("test") }]',
        },
      ],
    },
  };

  const logger = createMockLogger();
  const result: any = await run(plan, {}, { logger });

  t.is(result.x, 1);
});

test('data can be an array (expression)', async (t) => {
  const expression = 'export default [() => ({ data: [1,2,3] })]';

  const result: any = await run(expression, {}, {});
  t.deepEqual(result.data, [1, 2, 3]);
});

test('data can be an array (workflow)', async (t) => {
  const plan: ExecutionPlanNoOptions = {
    workflow: {
      steps: [
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
    },
  };

  const result: any = await run(plan, {}, {});
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

test('inject globals', async (t) => {
  const expression =
    'export default [(s) => Object.assign(s, { data: { x } })]';

  const result: any = await run(
    expression,
    {},
    {
      globals: {
        x: 90210,
      },
    }
  );
  t.is(result.data.x, 90210);
});

test("injected globals can't override special functions", async (t) => {
  const panic = () => {
    throw new Error('illegal override');
  };

  const globals = {
    console: panic,
    clearInterval: panic,
    clearTimeout: panic,
    parseFloat: panic,
    parseInt: panic,
    setInterval: panic,
    setTimeout: panic,
  };
  const expression = `export default [(s) => {
    parseFloat();
    parseInt();
    const i = setInterval(() => {}, 1000);
    clearInterval(i);
    const t = setTimeout(() => {}, 1000);
    clearTimeout(t);
    return s;
  }]`;

  const result: any = await run(expression, {}, { globals });
  t.falsy(result.errors);
});

test('run from an adaptor', async (t) => {
  const expression = `
    import { call } from 'x';
    export default [call(() => 22)];
  `;

  const result: any = await run(
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

  t.deepEqual(result, { data: 22 });
});

test('run a workflow using the repo and load the default version', async (t) => {
  const expression = `
    import result from 'ultimate-answer';
    export default [() => result];
  `;
  const plan = {
    workflow: {
      steps: [
        {
          id: 'a',
          expression,
        },
      ],
    },
  };

  const result: any = await run(
    plan,
    {},
    {
      linker: {
        repo: path.resolve('test/__repo__'),
      },
    }
  );

  t.deepEqual(result, 43);
});

test('run a workflow using the repo using a specific version', async (t) => {
  const expression = `
    import result from 'ultimate-answer';
    export default [() => result];
  `;
  const plan = {
    workflow: {
      steps: [
        {
          id: 'a',
          expression,
        },
      ],
    },
  };

  const result: any = await run(
    plan,
    {},
    {
      linker: {
        repo: path.resolve('test/__repo__'),
        modules: {
          'ultimate-answer': { version: '1.0.0' },
        },
      },
    }
  );

  t.deepEqual(result, 42);
});

test('run a workflow using the repo with multiple versions of the same adaptor', async (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        {
          id: 'a',
          expression: `import result from 'ultimate-answer';
          export default [(s) => { s.data.a = result; return s;}];`,
          adaptors: ['ultimate-answer@1.0.0'],
          next: { b: true },
        },
        {
          id: 'b',
          expression: `import result from 'ultimate-answer';
          export default [(s) => { s.data.b = result; return s;}];`,
          adaptors: ['ultimate-answer@2.0.0'],
        },
      ],
    },
  };

  const result: any = await run(
    plan,
    {},
    {
      linker: {
        repo: path.resolve('test/__repo__'),
      },
    }
  );

  t.deepEqual(result, {
    data: {
      a: 42,
      b: 43,
    },
  });
});

// https://github.com/OpenFn/kit/issues/520
test('run from an adaptor with error', async (t) => {
  const expression = `
    import { call } from 'x';
    export default [call("22")];
  `;

  const result: any = await run(
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

  // This should safely return with an error
  t.truthy(result.errors['job-1']);
});

test('accept a whitelist as a regex', async (t) => {
  const expression = `
    import { call } from 'blah';
    export default [call("22")];
  `;

  try {
    await run(
      expression,
      {},
      {
        linker: {
          whitelist: [/^@opennfn/],
        },
      }
    );
  } catch (error: any) {
    t.truthy(error);
    t.is(error.severity, 'crash');
    t.is(error.name, 'ImportError');
    t.is(error.message, 'module blacklisted: blah');
  }
});

test('accept a whitelist as a string', async (t) => {
  const expression = `
    import { call } from 'blah';
    export default [call("22")];
  `;

  try {
    await run(
      expression,
      {},
      {
        linker: {
          whitelist: ['/^@opennfn/'],
        },
      }
    );
  } catch (error: any) {
    t.truthy(error);
    t.is(error.severity, 'crash');
    t.is(error.name, 'ImportError');
    t.is(error.message, 'module blacklisted: blah');
  }
});
