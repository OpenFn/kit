import test from 'ava';
import path from 'node:path';
import run from '../src/runtime';

// This is irrelevant now as state and credentials are preloaded
test.todo('lazy state & credential loading');

// TODO I don't like the way ANY of these errors serialize
// Which is quite important for the CLI and for lightning
// Also this is raising the spectre of stack traces, which I don't particularly
// want to get into right now

test('crash on timeout', async (t) => {
  const expression = 'export default [(s) => new Promise((resolve) => {})]';

  let error;
  try {
    await run(expression, {}, { timeout: 1 });
  } catch (e) {
    console.log(e);
    error = e;
  }

  t.truthy(error);
  t.is(error.severity, 'crash');
  t.is(error.name, 'TimeoutError');
  t.is(error.message, 'Job took longer than 1ms to complete');
});

test('crash on runtime error with SyntaxError', async (t) => {
  const expression = 'export default [(s) => ~@]2q1j]';

  let error;
  try {
    await run(expression);
  } catch (e) {
    error = e;
  }

  t.truthy(error);
  t.is(error.severity, 'crash');
  t.is(error.subtype, 'SyntaxError');
  t.is(error.message, 'SyntaxError: Invalid or unexpected token');
});

test('crash on runtime error with ReferenceError', async (t) => {
  const expression = 'export default [(s) => x]';

  let error;
  try {
    await run(expression);
  } catch (e) {
    // console.log(e);
    // console.log(e.toString());
    error = e;
  }

  // t.true(error instanceof RuntimeError);
  t.is(error.severity, 'crash');
  t.is(error.subtype, 'ReferenceError');
  t.is(error.message, 'ReferenceError: x is not defined');
});

test('crash on runtime error with TypeError', async (t) => {
  const expression = 'export default [(s) => s.x.y]';

  let error;
  try {
    await run(expression);
  } catch (e) {
    error = e;
  }

  t.truthy(error);
  t.is(error.severity, 'crash');
  t.is(error.subtype, 'TypeError');
  t.is(
    error.message,
    "TypeError: Cannot read properties of undefined (reading 'y')"
  );
});

test('crash on runtime error with RangeError', async (t) => {
  const expression =
    'export default [(s) => Number.parseFloat("1").toFixed(-1)]';

  let error;
  try {
    await run(expression);
  } catch (e) {
    error = e;
  }

  t.truthy(error);
  t.is(error.severity, 'crash');
  t.is(error.subtype, 'RangeError');
  t.is(
    error.message,
    'RangeError: toFixed() digits argument must be between 0 and 100'
  );
});

test('crash on eval with SecurityError', async (t) => {
  const expression = 'export default [(s) => eval("process.exit()")]';

  let error;
  try {
    await run(expression);
  } catch (e) {
    error = e;
  }

  t.truthy(error);
  t.is(error.severity, 'crash');
  t.is(error.name, 'SecurityError');
  t.is(error.message, 'Illegal eval statement detected');
});

test('crash on edge condition error with EdgeConditionError', async (t) => {
  const workflow = {
    jobs: [
      {
        id: 'a',
        next: {
          b: {
            // Will throw a reference error
            condition: 'wibble',
          },
        },
      },
      { id: 'b' },
    ],
  };

  let error;
  try {
    await run(workflow);
  } catch (e) {
    error = e;
  }

  t.truthy(error);
  t.is(error.severity, 'crash');
  t.is(error.type, 'EdgeConditionError');
  t.is(error.message, 'wibble is not defined');
});

test.todo('crash on input error if a function is passed with forceSandbox');

// I think I'm gonna keep this broad for now, not catch too many cases
// I'll add a tech debt issue go through and add really tight handling
// so that if something goes wrong, we know exactly what
test('crash on import error: module path provided', async (t) => {
  const expression = 'import x from "blah"; export default [(s) => x]';

  let error;
  try {
    await run(expression);
  } catch (e) {
    error = e;
  }

  t.truthy(error);
  t.is(error.severity, 'crash');
  t.is(error.name, 'ImportError');
  t.is(error.message, 'Failed to import module "blah"');
});

test('crash on blacklisted module', async (t) => {
  const expression = 'import x from "blah"; export default [(s) => x]';

  let error;
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

  t.truthy(error);
  t.is(error.severity, 'crash');
  t.is(error.name, 'ImportError');
  t.is(error.message, 'module blacklisted: blah');
});

test('fail on user error with new Error()', async (t) => {
  const expression = 'export default [(s) => {throw new Error("abort")}]';

  const result = await run(expression);

  const error = result.errors['job-1'];

  t.is(error.name, 'UserError');
  t.is(error.message, 'abort');
});

test('fail on user error with throw "abort"', async (t) => {
  const expression = 'export default [(s) => {throw "abort"}]';

  const result = await run(expression);

  const error = result.errors['job-1'];

  t.is(error.name, 'UserError');
  t.is(error.message, 'abort');
});

test('fail on adaptor error (with throw new Error())', async (t) => {
  const expression = `
  import { err } from 'x';
  export default [(s) => err()];
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
  t.is(error.name, 'AdaptorError');
  t.is(error.message, 'adaptor err');
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
  t.is(error.name, 'UserError');
  t.is(error.message, 'adaptor err');
});
