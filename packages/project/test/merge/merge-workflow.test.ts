import test from 'ava';
import Workflow from '../../src/Workflow';
import { mergeWorkflows } from '../../src/merge/merge-workflow';
import type { MappingResults } from '../../src/merge/map-uuids';

// step 'x' exists on both sides and maps to itself - isolates mergeWorkflows'
// own field-picking logic from map-uuids' matching algorithm
const mappings: MappingResults = { nodes: { x: 'x' }, edges: {} };

test('mergeWorkflows: a step gaining a credential reference takes it from source, not target', (t) => {
  const target = new Workflow({
    id: 'wf',
    steps: [
      { id: 'x', name: 'X', adaptor: 'common', expression: 'fn(s => s)' },
    ],
  });
  const source = new Workflow({
    id: 'wf',
    steps: [
      {
        id: 'x',
        name: 'X',
        adaptor: 'common',
        expression: 'fn(s => s)',
        configuration: 'admin@openfn.org|b',
      },
    ],
  });

  const merged: any = mergeWorkflows(source, target, mappings);

  t.is(merged.steps[0].configuration, 'admin@openfn.org|b');
});

test('mergeWorkflows: a step explicitly clearing its credential reference (null) takes that from source too', (t) => {
  const target = new Workflow({
    id: 'wf',
    steps: [
      {
        id: 'x',
        name: 'X',
        adaptor: 'common',
        expression: 'fn(s => s)',
        configuration: 'admin@openfn.org|a',
      },
    ],
  });
  const source = new Workflow({
    id: 'wf',
    steps: [
      {
        id: 'x',
        name: 'X',
        adaptor: 'common',
        expression: 'fn(s => s)',
        configuration: null as any,
      },
    ],
  });

  const merged: any = mergeWorkflows(source, target, mappings);

  t.is(merged.steps[0].configuration, null);
});

test("mergeWorkflows: a source step that simply omits configuration (not null) leaves target's reference untouched", (t) => {
  const target = new Workflow({
    id: 'wf',
    steps: [
      {
        id: 'x',
        name: 'X',
        adaptor: 'common',
        expression: 'fn(s => s)',
        configuration: 'admin@openfn.org|a',
      },
    ],
  });
  const source = new Workflow({
    id: 'wf',
    steps: [
      { id: 'x', name: 'X', adaptor: 'common', expression: 'fn(s => s)' },
    ],
  });

  const merged: any = mergeWorkflows(source, target, mappings);

  t.is(merged.steps[0].configuration, 'admin@openfn.org|a');
});

test('mergeWorkflows: an unchanged credential reference survives the merge', (t) => {
  const target = new Workflow({
    id: 'wf',
    steps: [
      {
        id: 'x',
        name: 'X',
        adaptor: 'common',
        expression: 'fn(s => s)',
        configuration: 'admin@openfn.org|a',
      },
    ],
  });
  const source = new Workflow({
    id: 'wf',
    steps: [
      {
        id: 'x',
        name: 'X',
        adaptor: 'common',
        expression: 'fn(s => s)',
        configuration: 'admin@openfn.org|a',
      },
    ],
  });

  const merged: any = mergeWorkflows(source, target, mappings);

  t.is(merged.steps[0].configuration, 'admin@openfn.org|a');
});
