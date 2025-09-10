import * as l from '@openfn/lexicon';

import test from 'ava';
import mapUUIDs from '../../src/merge/map-uuids';
import { createWorkflow } from '../util';
import generateWorkflow from '../workflow-generator';

test('map triggers with the same name', (t) => {
  const source = generateWorkflow(['trigger']).set('trigger', {
    type: 'webhook',
  });
  const target = generateWorkflow(['trigger']).set('trigger', {
    type: 'webhook',
  });

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
  });
  // no edges here
  t.deepEqual(result.edges, {});
});

// map steps with the same name
// map edges with the same name

// map step with different id but same parent
// mark new step as new
// mark removed step as removed

test('node name changes but no positional change', (t) => {
  const source = generateWorkflow(['trigger-a', 'a-b']);
  const target = generateWorkflow(['trigger-c', 'c-b']);

  const result = mapUUIDs(source.workflow, target.workflow);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('c'),
    ['b']: target.getUUID('b'),
    ['c']: null,
  });
  // no retained edges
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-c'),
    ['a-b']: target.getUUID('c-b'),
    ['trigger-c']: null,
    ['c-b']: null,
  });
});

test('one connecting node missing', (t) => {
  const source = generateWorkflow(['a-b', 'b-c', 'b-d']);
  const target = generateWorkflow(['a-z', 'z-b', 'b-c', 'b-d']);

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('b'),
    ['c']: target.getUUID('c'),
    ['d']: target.getUUID('d'),
    ['z']: null,
  });

  // retained b-c and b-d
  t.deepEqual(result.edges, {
    ['b-c']: target.getUUID('b-c'),
    ['b-d']: target.getUUID('b-d'),
    ['a-b']: true,
    ['a-z']: null,
    ['z-b']: null,
  });
});

test('step removed from the middle', (t) => {
  const source = generateWorkflow(['a-b', 'b-c']);
  const target = generateWorkflow(['a-b', 'b-x', 'x-c']);

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('b'),
    ['c']: target.getUUID('c'),
    ['x']: null,
  });
  t.deepEqual(result.edges, {
    ['a-b']: target.getUUID('a-b'),
    ['b-c']: true,
    ['b-x']: null,
    ['x-c']: null,
  });
});

test('step added to the middle', (t) => {
  const source = generateWorkflow(['a-b', 'b-x', 'x-c']);
  const target = generateWorkflow(['a-b', 'b-c']);

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('b'),
    ['x']: true,
    ['c']: target.getUUID('c'),
  });
  t.deepEqual(result.edges, {
    ['a-b']: target.getUUID('a-b'),
    ['b-x']: true,
    ['x-c']: true,
    ['b-c']: null,
  });
});

test('children re-ordered. same parent', (t) => {
  const source = generateWorkflow(['a-b', 'a-c']);
  const target = generateWorkflow(['a-c', 'a-b']);

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('b'),
    ['c']: target.getUUID('c'),
  });
  t.deepEqual(result.edges, {
    ['a-b']: target.getUUID('a-b'),
    ['a-c']: target.getUUID('a-c'),
  });
});

test('step with changed id but same expression', (t) => {
  const source = generateWorkflow(['a-b']);
  const target = generateWorkflow(['a-x']);
  // set expression to b and x
  const expression = 'fn(s => s)';
  source.set('b', { expression });
  target.set('x', { expression });

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('x'),
    ['x']: null,
  });
  t.deepEqual(result.edges, {
    ['a-b']: target.getUUID('a-x'),
    ['a-x']: null,
  });
});

test('edge removed between existing nodes', (t) => {
  const source = generateWorkflow(['a-b']);
  const target = generateWorkflow(['a-b', 'a-c']);

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('b'),
    ['c']: null,
  });
  t.deepEqual(result.edges, {
    ['a-b']: target.getUUID('a-b'),
    ['a-c']: null,
  });
});

test('new edge added', (t) => {
  const source = generateWorkflow(['a-b', 'a-c']);
  const target = generateWorkflow(['a-b']);

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('b'),
    ['c']: true,
  });
  t.deepEqual(result.edges, {
    ['a-b']: target.getUUID('a-b'),
    ['a-c']: true,
  });
});

test('multiple steps and edges added and removed', (t) => {
  const source = generateWorkflow(['a-b', 'b-c', 'c-d']);
  const target = generateWorkflow(['a-x', 'x-b', 'b-y', 'y-c', 'c-d', 'd-z']);

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('b'),
    ['c']: target.getUUID('c'),
    ['d']: target.getUUID('d'),
    ['x']: null,
    ['y']: null,
    ['z']: null,
  });
  t.deepEqual(result.edges, {
    ['a-b']: true,
    ['b-c']: true,
    ['c-d']: target.getUUID('c-d'),
    ['a-x']: null,
    ['x-b']: null,
    ['b-y']: null,
    ['y-c']: null,
    ['d-z']: null,
  });
});

test('steps removed from a workflow', (t) => {
  const source = generateWorkflow(['a-b', 'a-c', 'b-d', 'c-d']);
  const target = generateWorkflow(['a-x', 'x-b', 'a-c', 'b-d', 'c-d', 'd-e']);

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('b'),
    ['c']: target.getUUID('c'),
    ['d']: target.getUUID('d'),
    ['e']: null,
    ['x']: null,
  });
  t.deepEqual(result.edges, {
    ['a-b']: true,
    ['a-c']: target.getUUID('a-c'),
    ['b-d']: target.getUUID('b-d'),
    ['c-d']: target.getUUID('c-d'),
    ['a-x']: null,
    ['x-b']: null,
    ['d-e']: null,
  });
});

// NEW TESTS

// narrowing by parent
// id changed but parent stayed the same
test('parent stayed same but id changed', (t) => {
  const source = generateWorkflow(['a-b']);
  const target = generateWorkflow(['a-x']);

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('x'),
    ['x']: null,
  });
  t.deepEqual(result.edges, {
    ['a-x']: null,
    ['a-b']: target.getUUID('a-x'),
  });
});

test('parent stayed same but id changed (with children)', (t) => {
  const source = generateWorkflow(['a-b', 'b-c']);
  const target = generateWorkflow(['a-x', 'x-c']);

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('x'),
    ['c']: target.getUUID('c'),
    ['x']: null,
  });
  t.deepEqual(result.edges, {
    ['a-x']: null,
    ['x-c']: null,
    ['a-b']: target.getUUID('a-x'),
    ['b-c']: target.getUUID('x-c'),
  });
});

// narrowing by children
// id changed, parent matched multiple children
test('multiple children after parent match', (t) => {
  const source = generateWorkflow(['a-b', 'b-c', 'b-d']);
  const target = generateWorkflow(['a-x', 'a-y', 'x-c', 'x-d']);

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('x'),
    ['c']: target.getUUID('c'),
    ['d']: target.getUUID('d'),
    ['x']: null,
    ['y']: null,
  });
  t.deepEqual(result.edges, {
    ['a-x']: null,
    ['x-c']: null,
    ['a-y']: null,
    ['x-d']: null,
    ['a-b']: target.getUUID('a-x'),
    ['b-c']: target.getUUID('x-c'),
    ['b-d']: target.getUUID('x-d'),
  });
});

test('multiple likely children after parent match', (t) => {
  const source = generateWorkflow(['a-b', 'b-c', 'b-d']);
  const target = generateWorkflow(['a-x', 'a-y', 'y-c', 'x-c', 'x-d']);

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('x'),
    ['c']: target.getUUID('c'),
    ['d']: target.getUUID('d'),
    ['x']: null,
    ['y']: null,
  });
  t.deepEqual(result.edges, {
    ['a-x']: null,
    ['x-c']: null,
    ['a-y']: null,
    ['x-d']: null,
    ['a-b']: target.getUUID('a-x'),
    ['b-c']: target.getUUID('x-c'),
    ['b-d']: target.getUUID('x-d'),
    ['y-c']: null,
  });
});

// narrowing by Expression
// id changed, parent matched multiple children with no subtrees
test('multiple children with no subtree after parent match', (t) => {
  const bExpression = "fn(state => ({b: 'value'}))";
  const source = generateWorkflow(['a-b', 'a-c']).set('b', {
    expression: bExpression,
  });
  const target = generateWorkflow(['a-x', 'a-y']).set('x', {
    expression: bExpression,
  });

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result.nodes, {
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('x'), // mapped
    ['c']: true,
    ['x']: null,
    ['y']: null,
  });
  t.deepEqual(result.edges, {
    ['a-x']: null,
    ['a-y']: null,
    ['a-b']: target.getUUID('a-x'),
    ['a-c']: true,
  });
});

// mapping by ids
test.only('no changes: single node workflow', (t) => {
  const source = generateWorkflow(['trigger']);
  const target = generateWorkflow(['trigger']);

  const result = mapUUIDs(source, target);
  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
  });
  t.deepEqual(result.edges, {});
});

test.only('no changes: multi node workflow', (t) => {
  const source = generateWorkflow(['trigger-a']);
  const target = generateWorkflow(['trigger-a']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('a'),
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-a'),
  });
});

test.only('no changes: huge workflow', (t) => {
  const source = generateWorkflow([
    'trigger-a',
    'trigger-b',
    'a-c',
    'a-d',
    'b-d',
    'b-e',
    'c-f',
    'e-g',
  ]);
  const target = generateWorkflow([
    'trigger-a',
    'trigger-b',
    'a-c',
    'a-d',
    'b-d',
    'b-e',
    'c-f',
    'e-g',
  ]);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('b'),
    ['c']: target.getUUID('c'),
    ['d']: target.getUUID('d'),
    ['e']: target.getUUID('e'),
    ['f']: target.getUUID('f'),
    ['g']: target.getUUID('g'),
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-a'),
    ['trigger-b']: target.getUUID('trigger-b'),
    ['a-c']: target.getUUID('a-c'),
    ['a-d']: target.getUUID('a-d'),
    ['b-d']: target.getUUID('b-d'),
    ['b-e']: target.getUUID('b-e'),
    ['c-f']: target.getUUID('c-f'),
    ['e-g']: target.getUUID('e-g'),
  });
});

test.only('id change: single node', (t) => {
  const source = generateWorkflow(['trigger']);
  const target = generateWorkflow(['activate']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('activate'), // trigger mapped to activate
    ['activate']: null,
  });
  t.deepEqual(result.edges, {});
});

test.only('id change: leaf nodes', (t) => {
  const source = generateWorkflow(['trigger-a', 'trigger-b']);
  const target = generateWorkflow(['trigger-x', 'trigger-y']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('x'),
    ['b']: target.getUUID('y'),
    ['x']: null,
    ['y']: null,
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-x'),
    ['trigger-b']: target.getUUID('trigger-y'),
    ['trigger-x']: null,
    ['trigger-y']: null,
  });
});

test.only('id change: internal node', (t) => {
  const source = generateWorkflow(['trigger-a', 'a-b']);
  const target = generateWorkflow(['trigger-x', 'x-b']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('x'),
    ['b']: target.getUUID('b'),
    ['x']: null,
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-x'),
    ['a-b']: target.getUUID('x-b'),
    ['trigger-x']: null,
    ['x-b']: null,
  });
});

test.only('id change: internal nodes(same parent and child)', (t) => {
  const source = generateWorkflow(['trigger-a', 'trigger-b', 'a-c', 'b-c']);
  const target = generateWorkflow(['trigger-x', 'trigger-y', 'x-c', 'y-c']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('x'),
    ['b']: target.getUUID('y'),
    ['c']: target.getUUID('c'),
    ['x']: null,
    ['y']: null,
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-x'),
    ['trigger-b']: target.getUUID('trigger-y'),
    ['a-c']: target.getUUID('x-c'),
    ['b-c']: target.getUUID('y-c'),
    ['trigger-x']: null,
    ['trigger-y']: null,
    ['x-c']: null,
    ['y-c']: null,
  });
});

test.only('id change: several internal nodes (mid-size workflow)', (t) => {
  const source = generateWorkflow([
    'trigger-a',
    'trigger-b',
    'a-c',
    'b-d',
    'c-e',
    'd-f',
    'e-g',
    'f-g',
  ]);

  const target = generateWorkflow([
    'trigger-a1',
    'trigger-b1',
    'a1-x',
    'b1-y',
    'x-e',
    'y-f',
    'e-z',
    'f-z',
  ]);

  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('a1'),
    ['b']: target.getUUID('b1'),
    ['c']: target.getUUID('x'),
    ['d']: target.getUUID('y'),
    ['e']: target.getUUID('e'),
    ['f']: target.getUUID('f'),
    ['g']: target.getUUID('z'),
    ['a1']: null,
    ['b1']: null,
    ['x']: null,
    ['y']: null,
    ['z']: null,
  });

  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-a1'),
    ['trigger-b']: target.getUUID('trigger-b1'),
    ['a-c']: target.getUUID('a1-x'),
    ['b-d']: target.getUUID('b1-y'),
    ['c-e']: target.getUUID('x-e'),
    ['d-f']: target.getUUID('y-f'),
    ['e-g']: target.getUUID('e-z'),
    ['f-g']: target.getUUID('f-z'),
    ['trigger-a1']: null,
    ['trigger-b1']: null,
    ['a1-x']: null,
    ['b1-y']: null,
    ['x-e']: null,
    ['y-f']: null,
    ['e-z']: null,
    ['f-z']: null,
  });
});

test.only('id change: several internal nodes (mid-size workflow) 2', (t) => {
  const source = generateWorkflow([
    'trigger-a',
    'trigger-b',
    'a-c',
    'a-d',
    'b-e',
    'b-f',
    'd-g',
    'e-g',
  ]);
  const target = generateWorkflow([
    'trigger-x',
    'trigger-y',
    'x-c',
    'x-m',
    'y-n',
    'y-f',
    'm-g',
    'n-g',
  ]);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('x'),
    ['b']: target.getUUID('y'),
    ['c']: target.getUUID('c'),
    ['d']: target.getUUID('m'),
    ['e']: target.getUUID('n'),
    ['f']: target.getUUID('f'),
    ['g']: target.getUUID('g'),
    ['x']: null,
    ['y']: null,
    ['m']: null,
    ['n']: null,
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-x'),
    ['trigger-b']: target.getUUID('trigger-y'),
    ['a-c']: target.getUUID('x-c'),
    ['a-d']: target.getUUID('x-m'),
    ['b-e']: target.getUUID('y-n'),
    ['b-e']: target.getUUID('y-n'),
    ['b-f']: target.getUUID('y-f'),
    ['d-g']: target.getUUID('m-g'),
    ['e-g']: target.getUUID('n-g'),
    ['trigger-x']: null,
    ['trigger-y']: null,
    ['x-c']: null,
    ['x-m']: null,
    ['y-n']: null,
    ['y-f']: null,
    ['m-g']: null,
    ['n-g']: null,
  });
});

test.only('node removal: single node', (t) => {
  const source = generateWorkflow([]);
  const target = generateWorkflow(['trigger']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: null,
  });
  t.deepEqual(result.edges, {});
});

test.only('node removal: leaf node', (t) => {
  const source = generateWorkflow(['trigger']);
  const target = generateWorkflow(['trigger-a']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: null,
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: null,
  });
});

test.only('node removal: multi leaf nodes (same parent)', (t) => {
  const source = generateWorkflow(['trigger']);
  const target = generateWorkflow(['trigger-a', 'trigger-b']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: null,
    ['b']: null,
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: null,
    ['trigger-b']: null,
  });
});

test.only('node removal: multi leaf nodes (different parents)', (t) => {
  const source = generateWorkflow(['trigger-a', 'trigger-b']);
  const target = generateWorkflow(['trigger-a', 'trigger-b', 'a-c', 'b-d']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('b'),
    ['c']: null,
    ['d']: null,
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-a'),
    ['trigger-b']: target.getUUID('trigger-b'),
    ['a-c']: null,
    ['b-d']: null,
  });
});

test.only('node removal: single node (different parents)', (t) => {
  const source = generateWorkflow(['trigger-a', 'trigger-b']);
  const target = generateWorkflow(['trigger-a', 'trigger-b', 'a-c', 'b-c']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('b'),
    ['c']: null,
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-a'),
    ['trigger-b']: target.getUUID('trigger-b'),
    ['a-c']: null,
    ['b-c']: null,
  });
});

test.only('node removal: internal node', (t) => {
  const source = generateWorkflow(['trigger-b']);
  const target = generateWorkflow(['trigger-a', 'a-b']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: null,
    ['b']: target.getUUID('b'),
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: null,
    ['trigger-b']: true,
    ['a-b']: null,
  });
});

// Breakpoint here!
test.only('node addition: single leaf node', (t) => {
  const source = generateWorkflow(['trigger-a']);
  const target = generateWorkflow(['trigger-a', 'a-b']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('a'),
    ['b']: null,
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-a'),
    ['a-b']: null,
  });
});

test.only('node addition: branching internal node', (t) => {
  const source = generateWorkflow(['trigger-a', 'a-b']);
  const target = generateWorkflow(['trigger-a', 'a-b', 'a-c', 'c-d']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('b'),
    ['c']: null,
    ['d']: null,
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-a'),
    ['a-b']: target.getUUID('a-b'),
    ['a-c']: null,
    ['c-d']: null,
  });
});

test.only('edge change: rewire to different parent', (t) => {
  const source = generateWorkflow(['trigger-a', 'a-b']);
  const target = generateWorkflow(['trigger-a', 'trigger-b']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('a'),
    ['b']: target.getUUID('b'),
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-a'),
    ['a-b']: true,
    ['trigger-b']: null,
  });
});

test.only('mixed change: rename + add new leaf', (t) => {
  const source = generateWorkflow(['trigger-a']);
  const target = generateWorkflow(['trigger-x', 'x-b']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('x'),
    ['b']: null,
    ['x']: null,
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-x'),
    ['x-b']: null,
    ['trigger-x']: null,
  });
});

test.skip('deep chain: multiple renames down a path', (t) => {
  const source = generateWorkflow(['trigger-a', 'a-b', 'b-c', 'c-d']);
  const target = generateWorkflow(['trigger-x', 'x-y', 'y-z', 'z-d']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
    ['a']: target.getUUID('x'),
    ['c']: target.getUUID('z'),
    ['d']: target.getUUID('d'),
    ['b']: true, // b got it's parent and child changed. Hence, not mapping. we need to use idMap
    ['x']: null,
    ['y']: null,
    ['z']: null,
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('trigger-x'),
    ['c-d']: target.getUUID('z-d'),
    ['a-b']: true,
    ['b-c']: true,
    ['trigger-x']: null,
    ['x-y']: null,
    ['y-z']: null,
    ['z-d']: null,
  });
});

test.skip('full rename: all nodes and edges renamed', (t) => {
  const source = generateWorkflow(['trigger-a', 'a-b', 'b-c']);
  const target = generateWorkflow(['start-x', 'x-y', 'y-z']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('start'),
    ['a']: target.getUUID('x'),
    ['b']: target.getUUID('y'),
    ['c']: target.getUUID('z'),
    ['start']: null,
    ['x']: null,
    ['y']: null,
    ['z']: null,
  });
  t.deepEqual(result.edges, {
    ['trigger-a']: target.getUUID('start-x'),
    ['a-b']: target.getUUID('x-y'),
    ['b-c']: target.getUUID('y-z'),
    ['start-x']: null,
    ['x-y']: null,
    ['y-z']: null,
  });
});
