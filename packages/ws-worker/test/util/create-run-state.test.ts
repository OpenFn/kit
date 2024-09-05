import test from 'ava';
import type { ExecutionPlan, Job } from '@openfn/lexicon';

import { createRunState } from '../../src/util';

const createPlan = (jobs: Partial<Job>[]) =>
  ({
    workflow: {
      steps: jobs.map((j) => ({ expression: '.', ...j })),
    },
    options: {},
  } as ExecutionPlan);

test('create run', (t) => {
  const plan = createPlan([{ id: 'a' }]);
  const input = undefined;

  const run = createRunState(plan, input);

  t.deepEqual(run.plan, plan);
  t.deepEqual(run.lastDataclipId, '');
  t.deepEqual(run.dataclips, {});
  t.deepEqual(run.inputDataclips, {});
  t.deepEqual(run.reasons, {});
});

test('Set initial input dataclip if no explicit start and first job is a step', (t) => {
  const plan = createPlan([{ id: 'a' }]);
  const input = 'x';

  const run = createRunState(plan, input);

  t.deepEqual(run.inputDataclips, { a: 'x' });
});

test('Set initial input dataclip if the explicit start is a step', (t) => {
  const plan = createPlan([{ id: 'a' }, { id: 'b' }]);
  plan.options.start = 'a';
  const input = 'x';

  const run = createRunState(plan, input);

  t.deepEqual(run.inputDataclips, { a: 'x' });
});

test('Set initial input dataclip if the start is a trigger (simple)', (t) => {
  const plan = createPlan([{ id: 't', next: { a: true } }, { id: 'a' }]);
  plan.options.start = 'a';
  const input = 's';

  const run = createRunState(plan, input);

  t.deepEqual(run.inputDataclips, { a: 's' });
});

test('Set initial input dataclip if the start is a trigger (complex)', (t) => {
  const plan = createPlan([
    { id: 'a' },
    { id: 'b' },
    { id: 'c' },
    { id: 'd' },
    { id: 't', next: { c: true }, expression: undefined },
  ]);
  plan.options.start = 't';
  const input = 's';

  const run = createRunState(plan, input);

  t.deepEqual(run.inputDataclips, { c: 's' });
});

test('Set initial input dataclip with a trigger as implicit start', (t) => {
  const plan = createPlan([
    { id: 't', next: { c: true }, expression: undefined },
    { id: 'a', expression: '.' },
    { id: 'b', expression: '.' },
    { id: 'c', expression: '.' },
    { id: 'd', expression: '.' },
  ]);
  const input = 's';

  const run = createRunState(plan, input);

  t.deepEqual(run.inputDataclips, { c: 's' });
});

test('Set initial input dataclip with a trigger with multiple downstream jobs', (t) => {
  const plan = createPlan([
    { id: 'a' },
    { id: 'b' },
    { id: 't', next: { a: true, b: true, c: true }, expression: undefined },
    { id: 'c' },
    { id: 'd' },
  ]);
  plan.options.start = 't';
  const input = 's';
  const run = createRunState(plan, input);

  t.deepEqual(run.inputDataclips, { a: 's', b: 's', c: 's' });
});

test("Do not throw if the start step doesn't exist", (t) => {
  const plan = createPlan([{ id: 'a' }]);
  plan.options.start = 'wibble';
  const input = 'x';

  createRunState(plan, input);

  t.pass('did not throw');
});

test('Do not throw  if there are no steps', (t) => {
  const plan = createPlan([{ id: 'a' }]);
  plan.workflow.steps = [];

  const input = 'x';

  createRunState(plan, input);

  t.pass('did not throw');
});
