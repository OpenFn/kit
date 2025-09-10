import * as l from '@openfn/lexicon';

import test from 'ava';
import mapUUIDs from '../../src/merge/map-uuids';
import { createWorkflow } from '../util';
import generateWorkflow from '../workflow-generator';

// mapping by ids
test('no changes: single node workflow', (t) => {
  const source = generateWorkflow(['trigger']);
  const target = generateWorkflow(['trigger']);

  const result = mapUUIDs(source, target);
  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
  });
  t.deepEqual(result.edges, {});
});

test('no changes: multi node workflow', (t) => {
  const source = generateWorkflow(['trigger-a']);
  const target = generateWorkflow(['trigger-a']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    a: target.getUUID('a'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-a'),
  });
});

test('no changes: huge workflow', (t) => {
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
    trigger: target.getUUID('trigger'),
    a: target.getUUID('a'),
    b: target.getUUID('b'),
    c: target.getUUID('c'),
    d: target.getUUID('d'),
    e: target.getUUID('e'),
    f: target.getUUID('f'),
    g: target.getUUID('g'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-a'),
    'trigger-b': target.getUUID('trigger-b'),
    'a-c': target.getUUID('a-c'),
    'a-d': target.getUUID('a-d'),
    'b-d': target.getUUID('b-d'),
    'b-e': target.getUUID('b-e'),
    'c-f': target.getUUID('c-f'),
    'e-g': target.getUUID('e-g'),
  });
});

test('id change: single node', (t) => {
  const source = generateWorkflow(['trigger']);
  const target = generateWorkflow(['activate']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('activate'), // trigger mapped to activate
  });
  t.deepEqual(result.edges, {});
});

test('id change: leaf nodes', (t) => {
  const source = generateWorkflow(['trigger-a', 'trigger-b']);
  const target = generateWorkflow(['trigger-x', 'trigger-y']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    a: target.getUUID('x'),
    b: target.getUUID('y'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-x'),
    'trigger-b': target.getUUID('trigger-y'),
  });
});

test('id change: internal node', (t) => {
  const source = generateWorkflow(['trigger-a', 'a-b']);
  const target = generateWorkflow(['trigger-x', 'x-b']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    a: target.getUUID('x'),
    b: target.getUUID('b'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-x'),
    'a-b': target.getUUID('x-b'),
  });
});

test('id change: internal nodes(same parent and child)', (t) => {
  const source = generateWorkflow(['trigger-a', 'trigger-b', 'a-c', 'b-c']);
  const target = generateWorkflow(['trigger-x', 'trigger-y', 'x-c', 'y-c']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    a: target.getUUID('x'),
    b: target.getUUID('y'),
    c: target.getUUID('c'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-x'),
    'trigger-b': target.getUUID('trigger-y'),
    'a-c': target.getUUID('x-c'),
    'b-c': target.getUUID('y-c'),
  });
});

test('id change: several internal nodes (mid-size workflow)', (t) => {
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
    trigger: target.getUUID('trigger'),
    a: target.getUUID('a1'),
    b: target.getUUID('b1'),
    c: target.getUUID('x'),
    d: target.getUUID('y'),
    e: target.getUUID('e'),
    f: target.getUUID('f'),
    g: target.getUUID('z'),
  });

  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-a1'),
    'trigger-b': target.getUUID('trigger-b1'),
    'a-c': target.getUUID('a1-x'),
    'b-d': target.getUUID('b1-y'),
    'c-e': target.getUUID('x-e'),
    'd-f': target.getUUID('y-f'),
    'e-g': target.getUUID('e-z'),
    'f-g': target.getUUID('f-z'),
  });
});

test('id change: several internal nodes (mid-size workflow) 2', (t) => {
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
    trigger: target.getUUID('trigger'),
    a: target.getUUID('x'),
    b: target.getUUID('y'),
    c: target.getUUID('c'),
    d: target.getUUID('m'),
    e: target.getUUID('n'),
    f: target.getUUID('f'),
    g: target.getUUID('g'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-x'),
    'trigger-b': target.getUUID('trigger-y'),
    'a-c': target.getUUID('x-c'),
    'a-d': target.getUUID('x-m'),
    'b-e': target.getUUID('y-n'),
    'b-e': target.getUUID('y-n'),
    'b-f': target.getUUID('y-f'),
    'd-g': target.getUUID('m-g'),
    'e-g': target.getUUID('n-g'),
  });
});

test('id change: chained internal nodes', (t) => {
  // special: this features a node b which has both parent and children changed
  const source = generateWorkflow(['trigger-a', 'a-b', 'b-c', 'b-d']);
  const target = generateWorkflow(['trigger-x', 'x-y', 'y-z', 'y-q']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    a: target.getUUID('x'),
    b: target.getUUID('y'),
    c: target.getUUID('z'),
    d: target.getUUID('q'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-x'),
    'a-b': target.getUUID('x-y'),
    'b-c': target.getUUID('y-z'),
    'b-d': target.getUUID('y-q'),
  });
});

test('node removal: single node', (t) => {
  const source = generateWorkflow([]);
  const target = generateWorkflow(['trigger']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {});
  t.deepEqual(result.edges, {});
});

test('node removal: leaf node', (t) => {
  const source = generateWorkflow(['trigger']);
  const target = generateWorkflow(['trigger-a']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
  });
  t.deepEqual(result.edges, {});
});

test('node removal: multi leaf nodes (same parent)', (t) => {
  const source = generateWorkflow(['trigger']);
  const target = generateWorkflow(['trigger-a', 'trigger-b']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
  });
  t.deepEqual(result.edges, {});
});

test('node removal: multi leaf nodes (different parents)', (t) => {
  const source = generateWorkflow(['trigger-a', 'trigger-b']);
  const target = generateWorkflow(['trigger-a', 'trigger-b', 'a-c', 'b-d']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    a: target.getUUID('a'),
    b: target.getUUID('b'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-a'),
    'trigger-b': target.getUUID('trigger-b'),
  });
});

test('node removal: single node (different parents)', (t) => {
  const source = generateWorkflow(['trigger-a', 'trigger-b']);
  const target = generateWorkflow(['trigger-a', 'trigger-b', 'a-c', 'b-c']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    a: target.getUUID('a'),
    b: target.getUUID('b'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-a'),
    'trigger-b': target.getUUID('trigger-b'),
  });
});

test('node removal: internal node', (t) => {
  const source = generateWorkflow(['trigger-b']);
  const target = generateWorkflow(['trigger-a', 'a-b']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    b: target.getUUID('b'),
  });
  t.deepEqual(result.edges, {});
});

// Breakpoint here!
test('node addition: single leaf node', (t) => {
  const source = generateWorkflow(['trigger-a']);
  const target = generateWorkflow(['trigger-a', 'a-b']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    a: target.getUUID('a'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-a'),
  });
});

test('node addition: branching internal node', (t) => {
  const source = generateWorkflow(['trigger-a', 'a-b']);
  const target = generateWorkflow(['trigger-a', 'a-b', 'a-c', 'c-d']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    a: target.getUUID('a'),
    b: target.getUUID('b'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-a'),
    'a-b': target.getUUID('a-b'),
  });
});

test('edge change: rewire to different parent', (t) => {
  const source = generateWorkflow(['trigger-a', 'a-b']);
  const target = generateWorkflow(['trigger-a', 'trigger-b']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    a: target.getUUID('a'),
    b: target.getUUID('b'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-a'),
  });
});

test('mixed change: rename + add new leaf', (t) => {
  const source = generateWorkflow(['trigger-a']);
  const target = generateWorkflow(['trigger-x', 'x-b']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    a: target.getUUID('x'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-x'),
  });
});

test.skip('deep chain: multiple renames down a path', (t) => {
  const source = generateWorkflow(['trigger-a', 'a-b', 'b-c', 'c-d']);
  const target = generateWorkflow(['trigger-x', 'x-y', 'y-z', 'z-d']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    a: target.getUUID('x'),
    c: target.getUUID('z'),
    d: target.getUUID('d'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-x'),
    'c-d': target.getUUID('z-d'),
  });
});

test.skip('full rename: all nodes and edges renamed', (t) => {
  const source = generateWorkflow(['trigger-a', 'a-b', 'b-c']);
  const target = generateWorkflow(['start-x', 'x-y', 'y-z']);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('start'),
    a: target.getUUID('x'),
    b: target.getUUID('y'),
    c: target.getUUID('z'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('start-x'),
    'a-b': target.getUUID('x-y'),
    'b-c': target.getUUID('y-z'),
  });
});
