import test from 'ava';
import Workflow from '../../src/Workflow';
import {
  generateStepDiff,
  generateEdgeDiff,
} from '../../src/util/workflow-diff';

const createWorkflow = (steps: any[]) =>
  new Workflow({ id: 'wf', name: 'Workflow', steps });

const createStep = (props: any = {}) => ({
  id: 'a',
  name: 'Step A',
  adaptor: '@openfn/language-common@1.0.0',
  expression: 'fn(s => s)',
  ...props,
});

test('generateStepDiff: returns empty array when both workflows are undefined', (t) => {
  const diff = generateStepDiff(undefined, undefined);
  t.deepEqual(diff, []);
});

test('generateStepDiff: returns empty array for identical workflows', (t) => {
  const step = createStep();
  const wf = createWorkflow([step]);
  const diff = generateStepDiff(wf, wf);
  t.deepEqual(diff, []);
});

test('generateStepDiff: should register a new step (added)', (t) => {
  const sharedStep = createStep({ id: 'a' });
  const newStep = createStep({ id: 'b', name: 'Step B' });

  const local = createWorkflow([sharedStep, newStep]);
  const remote = createWorkflow([sharedStep]);

  const changes = generateStepDiff(local, remote);

  const expected = { id: 'b', name: 'Step B', type: 'added' };
  t.deepEqual(changes, [expected]);
});

test('generateStepDiff: should register a removed step', (t) => {
  const sharedStep = createStep({ id: 'a' });
  const removedStep = createStep({ id: 'b', name: 'Step B' });

  const local = createWorkflow([sharedStep]);
  const remote = createWorkflow([sharedStep, removedStep]);

  const changes = generateStepDiff(local, remote);

  const expected = { id: 'b', name: 'Step B', type: 'removed' };
  t.deepEqual(changes, [expected]);
});

test('generateStepDiff: should register a change to a step expression (body)', (t) => {
  const local = createWorkflow([createStep({ expression: 'fn(x => x)' })]);
  const remote = createWorkflow([createStep({ expression: 'fn(s => s)' })]);

  const changes = generateStepDiff(local, remote);

  const expected = {
    id: 'a',
    name: 'Step A',
    type: 'changed',
    changes: { body: '+1 lines' },
  };
  t.deepEqual(changes, [expected]);
});

test('generateStepDiff: body diff reports +N lines when local has more lines', (t) => {
  const localExpr = 'fn(s => {\n  return s;\n})';
  const remoteExpr = 'fn(s => s)';

  const local = createWorkflow([createStep({ expression: localExpr })]);
  const remote = createWorkflow([createStep({ expression: remoteExpr })]);

  const changes = generateStepDiff(local, remote);

  const expected = {
    id: 'a',
    name: 'Step A',
    type: 'changed',
    changes: { body: '+3 lines' },
  };
  t.deepEqual(changes, [expected]);
});

test('generateStepDiff: body diff reports -N lines when local has fewer lines', (t) => {
  const localExpr = 'fn(s => s)';
  const remoteExpr = 'fn(s => {\n  return s;\n})';

  const local = createWorkflow([createStep({ expression: localExpr })]);
  const remote = createWorkflow([createStep({ expression: remoteExpr })]);

  const changes = generateStepDiff(local, remote);

  const expected = {
    id: 'a',
    name: 'Step A',
    type: 'changed',
    changes: { body: '-2 lines' },
  };
  t.deepEqual(changes, [expected]);
});

test('generateStepDiff: body diff reports +1 lines when line count is unchanged', (t) => {
  const local = createWorkflow([createStep({ expression: 'fn(s => s.x)' })]);
  const remote = createWorkflow([createStep({ expression: 'fn(s => s.y)' })]);

  const changes = generateStepDiff(local, remote);

  const expected = {
    id: 'a',
    name: 'Step A',
    type: 'changed',
    changes: { body: '+1 lines' },
  };
  t.deepEqual(changes, [expected]);
});

test('generateStepDiff: should register a change to a step name', (t) => {
  const local = createWorkflow([createStep({ name: 'New Name' })]);
  const remote = createWorkflow([createStep({ name: 'Old Name' })]);

  const changes = generateStepDiff(local, remote);

  const expected = {
    id: 'a',
    name: 'New Name',
    type: 'changed',
    changes: { name: { from: 'Old Name', to: 'New Name' } },
  };
  t.deepEqual(changes, [expected]);
});

test('generateStepDiff: should register a change to a step adaptor', (t) => {
  const local = createWorkflow([
    createStep({ adaptor: '@openfn/language-http@2.0.0' }),
  ]);
  const remote = createWorkflow([
    createStep({ adaptor: '@openfn/language-http@1.0.0' }),
  ]);

  const changes = generateStepDiff(local, remote);

  const expected = {
    id: 'a',
    name: 'Step A',
    type: 'changed',
    changes: {
      adaptor: {
        from: '@openfn/language-http@1.0.0',
        to: '@openfn/language-http@2.0.0',
      },
    },
  };
  t.deepEqual(changes, [expected]);
});

test('generateStepDiff: should register a change to a step configuration', (t) => {
  const local = createWorkflow([createStep({ configuration: 'new-credential' })]);
  const remote = createWorkflow([createStep({ configuration: 'old-credential' })]);

  const changes = generateStepDiff(local, remote);

  const expected = {
    id: 'a',
    name: 'Step A',
    type: 'changed',
    changes: { configuration: { from: 'old-credential', to: 'new-credential' } },
  };
  t.deepEqual(changes, [expected]);
});

test('generateStepDiff: should report multiple field changes on one step', (t) => {
  const local = createWorkflow([
    createStep({ name: 'New Name', adaptor: '@openfn/language-http@2.0.0' }),
  ]);
  const remote = createWorkflow([
    createStep({ name: 'Old Name', adaptor: '@openfn/language-http@1.0.0' }),
  ]);

  const changes = generateStepDiff(local, remote);

  t.is(changes.length, 1);
  t.truthy(changes[0].changes?.name);
  t.truthy(changes[0].changes?.adaptor);
});

test('generateStepDiff: added step uses name when available', (t) => {
  const newStep = createStep({ id: 'b', name: 'My Step' });
  const local = createWorkflow([createStep(), newStep]);
  const remote = createWorkflow([createStep()]);

  const changes = generateStepDiff(local, remote);

  t.is(changes[0].name, 'My Step');
});

test('generateStepDiff: added step falls back to id when name is absent', (t) => {
  const { name: _, ...namelessStep } = createStep({ id: 'b' });
  const local = createWorkflow([createStep(), namelessStep]);
  const remote = createWorkflow([createStep()]);

  const changes = generateStepDiff(local, remote);

  t.is(changes[0].name, 'b');
});

// ---------------------------------------------------------------------------
// generateEdgeDiff
// ---------------------------------------------------------------------------

const makeStepWithNext = (id: string, next: Record<string, any> = {}) => ({
  id,
  name: id,
  expression: 'fn(s => s)',
  next,
});

test('generateEdgeDiff: returns empty array when both workflows are undefined', (t) => {
  const diff = generateEdgeDiff(undefined, undefined);
  t.deepEqual(diff, []);
});

test('generateEdgeDiff: returns empty array for identical workflows', (t) => {
  const steps = [
    makeStepWithNext('a', { b: { condition: 'state.x' } }),
    makeStepWithNext('b'),
  ];
  const local = createWorkflow(steps);
  const remote = createWorkflow(steps);
  const diff = generateEdgeDiff(local, remote);
  t.deepEqual(diff, []);
});

test('generateEdgeDiff: should register a new edge (added)', (t) => {
  const local = createWorkflow([
    makeStepWithNext('a', { b: {}, c: {} }),
    makeStepWithNext('b'),
    makeStepWithNext('c'),
  ]);
  const remote = createWorkflow([
    makeStepWithNext('a', { b: {} }),
    makeStepWithNext('b'),
  ]);

  const changes = generateEdgeDiff(local, remote);

  const expected = { id: 'a->c', type: 'added' };
  t.deepEqual(changes, [expected]);
});

test('generateEdgeDiff: should register a removed edge', (t) => {
  const local = createWorkflow([
    makeStepWithNext('a', { b: {} }),
    makeStepWithNext('b'),
  ]);
  const remote = createWorkflow([
    makeStepWithNext('a', { b: {}, c: {} }),
    makeStepWithNext('b'),
    makeStepWithNext('c'),
  ]);

  const changes = generateEdgeDiff(local, remote);

  const expected = { id: 'a->c', type: 'removed' };
  t.deepEqual(changes, [expected]);
});

test('generateEdgeDiff: should register a change to an edge condition', (t) => {
  const local = createWorkflow([
    makeStepWithNext('a', { b: { condition: '!state.error' } }),
    makeStepWithNext('b'),
  ]);
  const remote = createWorkflow([
    makeStepWithNext('a', { b: { condition: 'state.ok' } }),
    makeStepWithNext('b'),
  ]);

  const changes = generateEdgeDiff(local, remote);

  const expected = {
    id: 'a->b',
    type: 'changed',
    changes: { condition: { from: 'state.ok', to: '!state.error' } },
  };
  t.deepEqual(changes, [expected]);
});

test('generateEdgeDiff: should register a change to an edge label', (t) => {
  const local = createWorkflow([
    makeStepWithNext('a', { b: { label: 'on success' } }),
    makeStepWithNext('b'),
  ]);
  const remote = createWorkflow([
    makeStepWithNext('a', { b: { label: 'always' } }),
    makeStepWithNext('b'),
  ]);

  const changes = generateEdgeDiff(local, remote);

  const expected = {
    id: 'a->b',
    type: 'changed',
    changes: { label: { from: 'always', to: 'on success' } },
  };
  t.deepEqual(changes, [expected]);
});

test('generateEdgeDiff: should register a change to edge disabled state', (t) => {
  const local = createWorkflow([
    makeStepWithNext('a', { b: { disabled: true } }),
    makeStepWithNext('b'),
  ]);
  const remote = createWorkflow([
    makeStepWithNext('a', { b: {} }),
    makeStepWithNext('b'),
  ]);

  const changes = generateEdgeDiff(local, remote);

  const expected = {
    id: 'a->b',
    type: 'changed',
    changes: { disabled: { from: undefined, to: true } },
  };
  t.deepEqual(changes, [expected]);
});
