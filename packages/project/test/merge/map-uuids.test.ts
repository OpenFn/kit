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

// why does this test matter?
// ok, he's doing it by parent node
// so this is all tests about a reparenting
// uh but is it?
// does it really matter? Isn't this a bit semantic?
// expression and adaptor are also changed and it's a 1:1 structure

// I think I want a test like:
// id changed but parent the same
// 2 ids changed under same parent
// 2 ids changed under different parents
// id changed and parent changed

// OR

// Single change (maybe add variants to handle different structures?)
// change: id
// change: id, parent
// change: id, parent, adaptor,
// change: id, parent, adaptor, expression // should we still map this if a 1:1 map?

// Now test multiple changes at once
// change: id / id
// change: id, parent / id, parent

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
