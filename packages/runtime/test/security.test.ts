// a suite of tests with various security concerns in mind
import test from 'ava';
import doRun from '../src/runtime';

import { createMockLogger } from '@openfn/logger';
import { ExecutionPlan } from '../src/types';

// Disable strict mode for all these tests
const run = (job: any, state?: any, options: any = {}) =>
  doRun(job, state, { ...options, strict: false });

const logger = createMockLogger(undefined, { level: 'default' });

test.afterEach(() => {
  logger._reset();
});

test.serial('jobs should not have access to global scope', async (t) => {
  const src = 'export default [() => globalThis.x]';
  // @ts-ignore
  globalThis.x = 42;

  const result: any = await run(src);
  t.falsy(result);

  // @ts-ignore
  delete globalThis.x;
});

test.serial('jobs should be able to read global state', async (t) => {
  const src = 'export default [() => state.data.x]';

  const result: any = await run(src, { data: { x: 42 } }); // typings are a bit tricky
  t.is(result, 42);
});

test.serial('jobs should be able to mutate global state', async (t) => {
  const src = 'export default [() => { state.x = 22; return state.x; }]';

  const result: any = await run(src, { data: { x: 42 } }); // typings are a bit tricky
  t.is(result, 22);
});

test.serial('jobs should each run in their own context', async (t) => {
  const src1 = 'export default [() => { globalThis.x = 1; return 1;}]';
  const src2 = 'export default [() => globalThis.x]';

  await run(src1);

  const r1 = (await run(src1)) as any;
  t.is(r1, 1);

  const r2 = (await run(src2)) as any;
  t.is(r2, undefined);
});

test.serial('jobs should not have a process object', async (t) => {
  const src = 'export default [() => process.pid]';

  const result = await run(src);

  t.truthy(result);

  const err = result.errors['job-1'];
  t.truthy(err);
  t.is(err.message, 'process is not defined');
  t.is(err.name, 'ReferenceError');
});

test.serial(
  'jobs should not be able to pass a string to setTimeout',
  async (t) => {
    const src = 'export default [() => setTimeout("hacking ur scriptz", 1)]';

    const result = await run(src);

    t.truthy(result);

    const err = result.errors['job-1'];
    t.truthy(err);
    t.is(err.name, 'TypeError');
    t.regex(err.message, /The "callback" argument must be of type function/);
    t.regex(err.message, /Received type string \('hacking ur scriptz'\)/);
  }
);

test.serial('code generation is disallowed (new Function)', async (t) => {
  const src = 'export default [() => new Function("return process")()]';

  const result = await run(src);

  t.truthy(result);

  const err = result.errors['job-1'];
  t.is(err.name, 'EvalError');
  t.regex(
    err.message,
    /Code generation from strings disallowed for this context/
  );
});

test.serial('code generation is disallowed (constructor)', async (t) => {
  const src =
    'export default [() => ({}).constructor.constructor("console.log(process.env)")()]';

  const result = await run(src);

  t.truthy(result);

  const err = result.errors['job-1'];
  t.is(err.name, 'EvalError');
  t.regex(
    err.message,
    /Code generation from strings disallowed for this context/
  );
});

test.serial('code generation is disallowed (eval)', async (t) => {
  const src = 'export default [() => eval("console.log(process.env)")]';

  const result = await run(src);

  t.truthy(result);

  const err = result.errors['job-1'];
  t.is(err.name, 'EvalError');
  t.regex(
    err.message,
    /Code generation from strings disallowed for this context/
  );
});

test.serial('jobs should be able to use sensible timeouts', async (t) => {
  const src =
    'export default [() => new Promise((resolve) => setTimeout(() => resolve(22), 1))]';

  const result: any = await run(src);
  t.is(result, 22);
});

// Relates to https://github.com/OpenFn/kit/issues/213
test.serial(
  'jobs in workflow cannot share data through globals (issue #213)',
  async (t) => {
    const plan: ExecutionPlan = {
      jobs: [
        {
          expression: 'export default [s => { console.x = 10; return s; }]',
          next: {
            b: true,
          },
        },
        {
          id: 'b',
          expression:
            'export default [s => { s.data.x = console.x; return s; }]',
        },
      ],
    };

    const result = await run(plan);
    t.truthy(result);

    const err = result.errors['job-1'];
    t.truthy(err);
    t.is(err.name, 'TypeError');
    t.is(err.message, 'Cannot add property x, object is not extensible');
  }
);
