import test from 'ava';

import { createRunState } from '../../src/util';

test('create run', (t) => {
  const options = { timeout: 666 };
  const plan = { jobs: [{ id: 'a' }] };
  const run = createRunState(plan, options);

  t.deepEqual(run.plan, plan);
  t.deepEqual(run.lastDataclipId, '');
  t.deepEqual(run.dataclips, {});
  t.deepEqual(run.inputDataclips, {});
  t.deepEqual(run.reasons, {});
  t.deepEqual(run.options, options);
});

test('Set initial input dataclip if no explicit start and first job is a step', (t) => {
  const plan = { initialState: 'x', jobs: [{ id: 'a', expression: '.' }] };
  const run = createRunState(plan);

  t.deepEqual(run.inputDataclips, { a: 'x' });
});

test('Set initial input dataclip if the explicit start is a step', (t) => {
  const plan = {
    initialState: 'x',
    start: 'a',
    jobs: [
      { id: 'b', expression: '.' },
      { id: 'a', expression: '.' },
    ],
  };
  const run = createRunState(plan);

  t.deepEqual(run.inputDataclips, { a: 'x' });
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
  const run = createRunState(plan);

  t.deepEqual(run.inputDataclips, { a: 's' });
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
  const run = createRunState(plan);

  t.deepEqual(run.inputDataclips, { c: 's' });
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
  const run = createRunState(plan);

  t.deepEqual(run.inputDataclips, { c: 's' });
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
  const run = createRunState(plan);

  t.deepEqual(run.inputDataclips, { a: 's', b: 's', c: 's' });
});
