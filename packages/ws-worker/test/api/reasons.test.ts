import test from 'ava';
import { RuntimeCrash } from '@openfn/runtime';
import { calculateJobExitReason } from '../../src/api/reasons';

test('success', (t) => {
  const jobId = 'a';
  const state: any = {};
  const error = undefined;
  const r = calculateJobExitReason(jobId, state, error);

  t.is(r.reason, 'success');
  t.is(r.error_type, null);
  t.is(r.error_message, null);
});

test('still success if a prior job has errors', (t) => {
  const jobId = 'a';
  const state: any = {
    errors: {
      b: {
        type: 'RuntimeError',
        message: '.',
        severity: 'fail',
      },
    },
  };
  const error = undefined;
  const r = calculateJobExitReason(jobId, state, error);

  t.is(r.reason, 'success');
  t.is(r.error_type, null);
  t.is(r.error_message, null);
});

test('fail', (t) => {
  const jobId = 'a';
  const state: any = {
    errors: {
      a: {
        type: 'RuntimeError',
        message: "TypeError: Cannot read properties of undefined (reading 'y')",
      },
    },
  };
  const error = undefined;
  const r = calculateJobExitReason(jobId, state, error);

  t.is(r.reason, 'fail');
  t.is(r.error_type, state.errors.a.type);
  t.is(r.error_message, state.errors.a.message);
});

test('crash', (t) => {
  const jobId = 'a';
  const state: any = {};
  const error = new RuntimeCrash(new ReferenceError('x is not defined'));
  const r = calculateJobExitReason(jobId, state, error);

  t.is(r.reason, 'crash');
  t.is(r.error_type, 'ReferenceError');
  t.is(r.error_message, 'ReferenceError: x is not defined');
});

test('crash has priority over fail', (t) => {
  const jobId = 'a';
  const state: any = {
    errors: {
      b: {
        type: 'RuntimeError',
        message: '.',
        severity: 'fail',
      },
    },
  };
  const error = new RuntimeCrash(new ReferenceError('x is not defined'));
  const r = calculateJobExitReason(jobId, state, error);

  t.is(r.reason, 'crash');
});

// This means a job didn't return state, which isn't great
// (and actually soon may be a fail)
// But it should not stop us calculating a reason
test('success if no state is passed', (t) => {
  const jobId = 'a';
  const state: any = undefined;
  const error = undefined;
  const r = calculateJobExitReason(jobId, state, error);

  t.is(r.reason, 'success');
  t.is(r.error_type, null);
  t.is(r.error_message, null);
});

test('success if boolean state is passed', (t) => {
  const jobId = 'a';
  const state: any = true;
  const error = undefined;
  const r = calculateJobExitReason(jobId, state, error);

  t.is(r.reason, 'success');
  t.is(r.error_type, null);
  t.is(r.error_message, null);
});
