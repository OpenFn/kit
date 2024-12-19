import test from 'ava';
import path from 'node:path';
import type { WorkflowOptions } from '@openfn/lexicon';
import compile from '@openfn/compiler';

import run from '../src/runtime';
import { extractCallSite } from '../src';

const createPlan = (expression: string, options: WorkflowOptions = {}) => ({
  workflow: {
    steps: [
      {
        expression,
      },
    ],
  },
  options,
});

test('extractCallSite', (t) => {
  const fakeError = {
    stack: `Error: some error
 at assertRuntimeCrash (/repo/openfn/kit/packages/runtime/src/errors.ts:25:15)`,
  };

  extractCallSite(fakeError);

  t.deepEqual(fakeError.pos, {
    line: 25,
    col: 15,
  });
});

test('crash on timeout', async (t) => {
  const expression = 'export default [(s) => new Promise((resolve) => {})]';

  const plan = createPlan(expression, { timeout: 1 });
  let error: any;
  try {
    await run(plan);
  } catch (e) {
    error = e;
  }
  t.log(error);

  t.is(error.severity, 'kill');
  t.is(error.message, 'Job took longer than 1ms to complete');
});

test('crash on runtime error with SyntaxError', async (t) => {
  const expression = 'export default [(s) => ~@]2q1j]';

  let error: any;
  try {
    await run(expression);
  } catch (e) {
    error = e;
  }
  t.log(error);

  t.is(error.severity, 'crash');
  t.is(error.subtype, 'SyntaxError');
  t.is(error.message, 'SyntaxError: Invalid or unexpected token');
});

test('crash on runtime error with ReferenceError', async (t) => {
  const expression = 'export default [(s) => x]';

  let error: any;
  try {
    await run(expression);
  } catch (e) {
    // console.log(e);
    error = e;
  }
  t.log(error);

  t.is(error.severity, 'crash');
  t.is(error.subtype, 'ReferenceError');
  t.is(error.message, 'ReferenceError: x is not defined');

  // Ensure an unmapped error position
  t.deepEqual(error.pos, {
    line: 1,
    col: 24,
  });
});

test.only('maps positions in a compiled ReferenceError', async (t) => {
  const expression = `function fn(f) { return f() }
fn((s) => x)`;

  // compile the code so we get a source map
  const { code, map } = compile(expression, { name: 'src' });
  t.log(code)
  let error: any;
  try {
    await run(code, {}, { sourceMap: map });
  } catch (e) {
    // console.log(e);
    error = e;
  }

  // validate that this is the error we're expecting
  t.is(error.subtype, 'ReferenceError');

  // ensure a position is written to the error
  // TODO note this is un-mapped at the moment
  t.deepEqual(error.pos, {
    line: 2,
    col: 11,
  });

  // TODO we could verify that (2,11) points to x
  // and that in the uncompiled code, x is at 2,<whatever>
});

test('crash on eval with SecurityError', async (t) => {
  const expression = 'export default [(s) => eval("process.exit()")]';

  let error: any;
  try {
    await run(expression);
  } catch (e) {
    error = e;
  }
  t.log(error);

  t.is(error.severity, 'kill');
  t.is(error.message, 'Illegal eval statement detected');
});

test('crash on edge condition error with EdgeConditionError', async (t) => {
  const plan = {
    workflow: {
      steps: [
        {
          id: 'a',
          expression: '.',
          next: {
            b: {
              // Will throw a reference error
              condition: 'wibble',
            },
          },
        },
        { id: 'b', expression: '.' },
      ],
    },
  };

  let error: any;
  try {
    await run(plan);
  } catch (e) {
    error = e;
  }
  t.log(error);

  t.is(error.severity, 'crash');
  t.is(error.message, 'wibble is not defined');
});

test.todo('crash on input error if a function is passed with forceSandbox');

// I think I'm gonna keep this broad for now, not catch too many cases
// I'll add a tech debt issue go through and add really tight handling
// so that if something goes wrong, we know exactly what
test('crash on import error: module path provided', async (t) => {
  const expression = 'import x from "blah"; export default [(s) => x]';

  let error: any;
  try {
    await run(expression);
  } catch (e) {
    error = e;
  }
  t.log(error);

  t.is(error.severity, 'crash');
  t.is(error.message, 'Failed to import module "blah"');
});

test('crash on blacklisted module', async (t) => {
  const expression = 'import x from "blah"; export default [(s) => x]';

  let error: any;
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
  } catch (e) {
    error = e;
  }
  t.log(error);

  t.is(error.severity, 'crash');
  t.is(error.message, 'module blacklisted: blah');
});

test('fail on runtime TypeError', async (t) => {
  const expression = 'export default [(s) => s.x.y]';

  const result: any = await run(expression);
  const error = result.errors['job-1'];
  t.log(error);

  t.deepEqual(error, {
    message: "TypeError: Cannot read properties of undefined (reading 'y')",
    name: 'RuntimeError',
    subtype: 'TypeError',
    severity: 'fail',
    source: 'runtime',
  });
});

// TODO not totally convinced on this one actually
test('fail on runtime error with RangeError', async (t) => {
  const expression =
    'export default [(s) => Number.parseFloat("1").toFixed(-1)]';

  const result: any = await run(expression);
  const error = result.errors['job-1'];

  t.log(error);

  t.deepEqual(error, {
    message: 'RangeError: toFixed() digits argument must be between 0 and 100',
    name: 'RuntimeError',
    subtype: 'RangeError',
    severity: 'fail',
    source: 'runtime',
  });
});

test('fail on user error with new Error()', async (t) => {
  const expression = 'export default [(s) => {throw new Error("abort")}]';

  const result: any = await run(expression);

  const error = result.errors['job-1'];
  t.log(error);

  t.deepEqual(error, {
    message: 'abort',
    name: 'JobError',
    severity: 'fail',
    source: 'runtime',
  });
});

test('fail on user error with throw "abort"', async (t) => {
  const expression = 'export default [(s) => {throw "abort"}]';

  const result: any = await run(expression);

  const error = result.errors['job-1'];
  t.log(error);

  t.deepEqual(error, {
    message: 'abort',
    name: 'JobError',
    severity: 'fail',
    source: 'runtime',
  });
});

test('fail on adaptor error (with throw new Error())', async (t) => {
  const expression = `
  import { err } from 'x';
  export default [(s) => err()];
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

  const error = result.errors['job-1'];
  t.log(error);

  t.deepEqual(error, {
    details: {
      code: 1234,
    },
    message: 'adaptor err',
    name: 'AdaptorError',
    source: 'runtime',
    severity: 'fail',
  });
});

test('adaptor error with no stack trace will be a user error', async (t) => {
  // this will throw "adaptor err"
  // Since it has no stack trace, we don't really know a lot about it
  // How can we handle a case like this?
  const expression = `
  import { err2 } from 'x';
  export default [(s) => err2()];
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

  const error = result.errors['job-1'];

  t.log(error);

  t.deepEqual(error, {
    message: 'adaptor err',
    name: 'JobError',
    severity: 'fail',
    source: 'runtime',
  });
});
