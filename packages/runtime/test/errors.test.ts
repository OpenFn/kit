import test from 'ava';
import path from 'node:path';
import type { WorkflowOptions } from '@openfn/lexicon';
import compile from '@openfn/compiler';

import run from '../src/runtime';

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

test.only('crash on runtime error with ReferenceError', async (t) => {
  const expression = 'export default [(s) => x]';

  // compile the code so we get a source map
  const { code, map } = compile(expression, { name: 'src' });
  console.log({ code, map });

  let error: any;
  try {
    await run(code, { map });
  } catch (e) {
    console.log(e);
    error = e;
  }
  t.log(error);

  // t.true(error instanceof RuntimeError);
  t.is(error.severity, 'crash');
  t.is(error.subtype, 'ReferenceError');
  t.is(error.message, 'ReferenceError: x is not defined');
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
