import test from 'ava';
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
