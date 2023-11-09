import test from 'ava';
import { RuntimeCrash } from '@openfn/runtime';
import { calculateJobExitReason } from '../../src/api/reasons';

test('success', (t) => {
  const jobId = 'a';
  const state = {};
  const error = undefined;
  const r = calculateJobExitReason(jobId, state, error);

  t.is(r.reason, 'success');
  t.is(r.error_type, null);
  t.is(r.message, null);
});

test('still success if a prior job has errors', (t) => {
  const jobId = 'a';
  const state = {
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
  t.is(r.message, null);
});

test('fail', (t) => {
  const jobId = 'a';
  const state = {
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
  t.is(r.message, state.errors.a.message);
});

test('crash', (t) => {
  const jobId = 'a';
  const state = {};
  const error = new RuntimeCrash(new ReferenceError('x is not defined'));
  const r = calculateJobExitReason(jobId, state, error);

  t.is(r.reason, 'crash');
  t.is(r.error_type, 'ReferenceError');
  t.is(r.message, 'ReferenceError: x is not defined');
});

test('crash has priority over fail', (t) => {
  const jobId = 'a';
  const state = {
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
