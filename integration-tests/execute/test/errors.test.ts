import test from 'ava';
import execute from '../src/execute';

// This tests the raw errors that come out of runtime
// (or are written to state)
// How those errors are serialized, displayed and emitted
// is a problem for the runtime managers (which can have their own tests)

test.serial('should throw a reference error', async (t) => {
  const state = { data: { x: 1 } };

  const job = `fn((s) => x)`;

  //  Tell the compiler not to import x from the adaptor
  const ignore = ['x'];

  let err;
  try {
    await execute(job, state, 'common', ignore);
  } catch (e: any) {
    err = e;
  }

  t.is(err.message, 'ReferenceError: x is not defined');
  t.is(err.severity, 'crash');
  t.is(err.step, 'src'); // this name is auto-generated btw
  t.deepEqual(err.pos, {
    column: 11,
    line: 1,
    src: 'fn((s) => x)',
  });
});

test.serial('should throw a type error', async (t) => {
  const state = { data: { x: 1 } };

  const job = `fn((s) => s())`;

  //  Tell the compiler not to import x from the adaptor
  const ignore = ['x'];

  const result = await execute(job, state, 'common', ignore);
  const err = result.errors['src'];
  t.log(err.pos);

  t.is(err.message, 'TypeError: s is not a function');
  t.is(err.severity, 'fail');
  t.is(err.step, 'src');
  t.deepEqual(err.pos, {
    column: 11,
    line: 1,
    src: 'fn((s) => s())',
  });
});

// In http 6.4.3 this throws a type error
// because the start of the error message is TypeError
// In 6.5 we get a better error out
// But the real question is: is AdaptorError even a useful error class?
// I think it confuses people
test.serial.skip('should throw an adaptor error', async (t) => {
  const state = { data: { x: 1 } };

  const job = `fn((s) => s)
get("www")`;

  const result = await execute(job, state, 'http');
  const err = result.errors['src'];
  t.log(err);

  t.is(err.message, 'AdaptorError: INVALID_URL');
});
