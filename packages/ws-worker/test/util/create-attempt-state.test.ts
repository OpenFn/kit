import test from 'ava';

import { createAttemptState } from '../../src/util';

test('create attempt', (t) => {
  const options = { timeout: 666 };
  const plan = { jobs: [{ id: 'a' }] };
  const attempt = createAttemptState(plan, options);

  t.deepEqual(attempt.plan, plan);
  t.deepEqual(attempt.lastDataclipId, '');
  t.deepEqual(attempt.dataclips, {});
  t.deepEqual(attempt.inputDataclips, {});
  t.deepEqual(attempt.reasons, {});
  t.deepEqual(attempt.options, options);
});

test('Set initial input dataclip if no explicit start and first job is a run', (t) => {
  const plan = { initialState: 'x', jobs: [{ id: 'a', expression: '.' }] };
  const attempt = createAttemptState(plan);

  t.deepEqual(attempt.inputDataclips, { a: 'x' });
});

test('Set initial input dataclip if the explicit start is a run', (t) => {
  const plan = {
    initialState: 'x',
    start: 'a',
    jobs: [
      { id: 'b', expression: '.' },
      { id: 'a', expression: '.' },
    ],
  };
  const attempt = createAttemptState(plan);

  t.deepEqual(attempt.inputDataclips, { a: 'x' });
});

test('Set initial input dataclip if the start is a trigger (simple)', (t) => {
  const plan = {
    initialState: 's',
    start: 't',
    jobs: [
      { id: 't', next: { a: true } },
      { id: 'a', expression: '.' },
    ],
  };
  const attempt = createAttemptState(plan);

  t.deepEqual(attempt.inputDataclips, { a: 's' });
});

test('Set initial input dataclip if the start is a trigger (complex)', (t) => {
  const plan = {
    initialState: 's',
    start: 't',
    jobs: [
      { id: 'a', expression: '.' },
      { id: 'b', expression: '.' },
      { id: 'c', expression: '.' },
      { id: 'd', expression: '.' },
      { id: 't', next: { c: true } },
    ],
  };
  const attempt = createAttemptState(plan);

  t.deepEqual(attempt.inputDataclips, { c: 's' });
});

test('Set initial input dataclip with a trigger as implicit start', (t) => {
  const plan = {
    initialState: 's',
    jobs: [
      { id: 't', next: { c: true } },
      { id: 'a', expression: '.' },
      { id: 'b', expression: '.' },
      { id: 'c', expression: '.' },
      { id: 'd', expression: '.' },
    ],
  };
  const attempt = createAttemptState(plan);

  t.deepEqual(attempt.inputDataclips, { c: 's' });
});

test('Set initial input dataclip with a trigger with multiple downstream jobs', (t) => {
  const plan = {
    initialState: 's',
    start: 't',
    jobs: [
      { id: 'a', expression: '.' },
      { id: 'b', expression: '.' },
      { id: 't', next: { a: true, b: true, c: true } },
      { id: 'c', expression: '.' },
      { id: 'd', expression: '.' },
    ],
  };
  const attempt = createAttemptState(plan);

  t.deepEqual(attempt.inputDataclips, { a: 's', b: 's', c: 's' });
});
