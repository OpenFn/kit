import test from 'ava';
import path from 'node:path';
import run from '../src/runtime';
import { RuntimeError } from '../src/errors';

/**
  reproduce various errors and test how the runtime responds
  it should basically throw with a set of expected error cases
  
  InputError - the workflow structure failed validation
  RuntimeError - error while executing. This could have a subtype like TypeError, ReferenceError
                 It is a bit of a confusing name, is  JobError, ExpressionError or ExeuctionError better?
  CompileError - error while compiling code, probably a syntax error
  LinkerError - basically a problem loading any dependency (probably the adaptor)
                ModuleError? DependencyError? ImportError?
  TimeoutError - a job ran for too long
  ResolveError - a state or credential resolver failed (is this an input error?)
  
  what about code generation errors? That'll be a RuntimeError, should we treat it spedcially?
  SecurityError maybe?

  Note that there are errors we can't catch here, like memory or diskspace blowups, infinite loops.
  It's the worker's job to catch those and report the crash

  We'll have a RuntimeError type which has as reason string (that gets forwarded to the worker)
  a type and subtype, and a message

  Later we'll do stacktraces and positions and stuff but not now. Maybe for a JobError I guess?
 */

test.todo('eval/codegen');
test.todo("linker error (load a module we don't have)");
test.todo('timeout');
test.todo('input errors');

// TODO I don't like the way ANY of these errors serialize
// Which is quite importnat for the CLI and for lightning
// Also this is raising the spectre of stack traces, which I don't particularly
// want to get into right now

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

// this is a syntax error too
//const expression = 'export default [(s) => throw new Error("abort")]';

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

test.todo('crash on blacklisted module');

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
