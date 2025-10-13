import * as l from '@openfn/lexicon';

import test from 'ava';
import mapUUIDs from '../../src/merge/map-uuids';
import generateWorkflow from '../../src/gen/generator';
import Workflow from '../../src/Workflow';

const gen = (src) => generateWorkflow(src, { uuidSeed: 1 });

const createSingleNode = (name, uuid) =>
  new Workflow({
    steps: [
      {
        id: name,
        name,
        openfn: { uuid: uuid ?? crypto.randomUUID() },
      },
    ],
  });

// mapping by ids
test('no changes: single node workflow', (t) => {
  const source = createSingleNode('trigger');
  const target = createSingleNode('trigger');

  const result = mapUUIDs(source, target);
  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
  });
  t.deepEqual(result.edges, {});
});

test('no changes: multi node workflow', (t) => {
  const source = gen('trigger-a');
  const target = gen('trigger-a');
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
  const source = gen(`
    trigger-a
    trigger-b
    a-c
    a-d
    b-d
    b-e
    c-f
    e-g
  `);
  const target = gen(`
    trigger-a
    trigger-b
    a-c
    a-d
    b-d
    b-e
    c-f
    e-g
  `);
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
  const source = createSingleNode('trigger');
  const target = createSingleNode('activate');
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('activate'), // trigger mapped to activate
  });
  t.deepEqual(result.edges, {});
});

test('id change: leaf nodes', (t) => {
  const source = gen(`trigger-a trigger-b`);
  const target = gen(`trigger-x trigger-y`);
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
  const source = gen(`trigger-a a-b`);
  const target = gen(`trigger-x x-b`);
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
  const source = gen(`trigger-a trigger-b a-c b-c`);
  const target = gen(`trigger-x trigger-y x-c y-c`);
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
  const source = gen(`
    trigger-a
    trigger-b
    a-c
    b-d
    c-e
    d-f
    e-g
    f-g
  `);

  const target = gen(`
    trigger-a1
    trigger-b1
    a1-x
    b1-y
    x-e
    y-f
    e-z
    f-z
  `);

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
  const source = gen(`
    trigger-a
    trigger-b
    a-c
    a-d
    b-e
    b-f
    d-g
    e-g
  `);
  const target = gen(`
    trigger-x
    trigger-y
    x-c
    x-m
    y-n
    y-f
    m-g
    n-g
  `);
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
    'b-f': target.getUUID('y-f'),
    'd-g': target.getUUID('m-g'),
    'e-g': target.getUUID('n-g'),
  });
});

test('id change: chained internal nodes', (t) => {
  // special: this features a node b which has both parent and children changed
  const source = gen(`trigger-a a-b b-c b-d`);
  const target = gen(`trigger-x x-y y-z y-q`);
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
  const source = new Workflow({ steps: [] });
  const target = createSingleNode('trigger');
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {});
  t.deepEqual(result.edges, {});
});

test('node removal: leaf node', (t) => {
  const source = createSingleNode('trigger');
  const target = gen(`trigger-a`);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    ['trigger']: target.getUUID('trigger'),
  });
  t.deepEqual(result.edges, {});
});

test('node removal: multi leaf nodes (same parent)', (t) => {
  const source = createSingleNode('trigger');
  const target = gen(`trigger-a trigger-b`);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
  });
  t.deepEqual(result.edges, {});
});

test('node removal: multi leaf nodes (different parents)', (t) => {
  const source = gen(`trigger-a trigger-b`);
  const target = gen(`trigger-a trigger-b a-c b-d`);
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
  const source = gen(`trigger-a trigger-b`);
  const target = gen(`trigger-a trigger-b a-c b-c`);
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
  const source = gen(`trigger-b`);
  const target = gen(`trigger-a a-b`);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    b: target.getUUID('b'),
  });
  t.deepEqual(result.edges, {});
});

// Breakpoint here!
test('node addition: single leaf node', (t) => {
  const source = gen(`trigger-a`);
  const target = gen(`trigger-a a-b`);
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
  const source = gen(`trigger-a a-b`);
  const target = gen(`trigger-a a-b a-c c-d`);
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
  const source = gen(`trigger-a a-b`);
  const target = gen(`trigger-a trigger-b`);
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
  const source = gen(`trigger-a`);
  const target = gen(`trigger-x x-b`);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    a: target.getUUID('x'),
  });
  t.deepEqual(result.edges, {
    'trigger-a': target.getUUID('trigger-x'),
  });
});

test('move: children move to a sibling', (t) => {
  const source = gen(`trigger-m m-n m-o o-d o-e`);
  const target = gen(`trigger-a a-b a-c b-d b-e`);
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    m: target.getUUID('a'),
    o: target.getUUID('b'),
    n: target.getUUID('c'),
    d: target.getUUID('d'),
    e: target.getUUID('e'),
  });
  t.deepEqual(result.edges, {
    'trigger-m': target.getUUID('trigger-a'),
    'm-n': target.getUUID('a-c'),
    'm-o': target.getUUID('a-b'),
    'o-d': target.getUUID('b-d'),
    'o-e': target.getUUID('b-e'),
  });
});

test('expression-based mapping: nodes only distinguishable by expression', (t) => {
  const source = gen(`trigger-x trigger-y`);
  const target = gen(`trigger-a trigger-b`);

  source.set('x', { expression: 'foo' });
  source.set('y', { expression: 'bar' });
  target.set('a', { expression: 'foo' });
  target.set('b', { expression: 'bar' });
  const result = mapUUIDs(source, target);

  t.deepEqual(result.nodes, {
    trigger: target.getUUID('trigger'),
    x: target.getUUID('a'),
    y: target.getUUID('b'),
  });

  // switch the expressions and expect mappings to switch
  // from x -> a, y -> b to x -> b, y -> a
  source.set('x', { expression: 'bar' });
  source.set('y', { expression: 'foo' });
  const sresult = mapUUIDs(source, target);

  t.deepEqual(sresult.nodes, {
    trigger: target.getUUID('trigger'),
    x: target.getUUID('b'),
    y: target.getUUID('a'),
  });
});

// we need to do some testing around multiple roots.
test.skip('multiple roots:', () => {});
