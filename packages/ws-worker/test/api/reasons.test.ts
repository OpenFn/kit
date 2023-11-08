import test from 'ava';
import { calculateJobReason } from '../../src/api/reasons';

const nil = '-';

test('success', (t) => {
  const jobId = 'a';
  const state = {};
  const error = undefined;
  const r = calculateJobReason(jobId, state, error);

  t.is(r.reason,'success')
  t.is(r.error_type, nil)
  t.is(r.message, nil)
  t.is(r.source, nil)
})

test('still success if a prior job has errors', (t) => {
  const jobId = 'a';
  const state = {
    errors: {
      'b': {
        type: 'RuntimeError',
        message: '.',
        severity: 'fail',
      }
    }
  };
  const error = undefined;
  const r = calculateJobReason(jobId, state, error);

  t.is(r.reason,'success')
  t.is(r.error_type, nil)
  t.is(r.message, nil)
  t.is(r.source, nil)
})

test('fail', (t) => {
  const jobId = 'a';
  const state = {
    errors: {
      a: {
        // reminder: the runtime generates this error object
        type: 'RuntimeError',
        message: "TypeError: Cannot read properties of undefined (reading 'y')",
      }
    }
  };
  const error = undefined;
  const r = calculateJobReason(jobId, state, error);

  t.is(r.reason,'fail')
  t.is(r.error_type, state.errors.a.type)
  t.is(r.message, state.errors.a.message)
  t.is(r.source, nil)
})

// If this is a crash, surely it shouldn't write to state.errors!
test.skip('crash', (t) => {
  const jobId = 'a';
  const state = {
    errors: {
      a: {
        // reminder: the runtime generates this error object
        type: 'RuntimeError',
        message: 'ReferenceError: x is not defined',
        severity: 'crash'
      }
    }
  };
  const error = undefined;
  const r = calculateJobReason(jobId, state, error);

  t.is(r.reason,'crash')
  t.is(r.error_type, state.errors.a.type)
  t.is(r.message, state.errors.a.message)
  t.is(r.source, nil)
})

test.todo('report the error object over state.error')