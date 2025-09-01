import test from 'ava';
import { getUuidForStep, getUuidForEdge } from '../../src/util/uuid';
import { Project } from '../../src/Project';
import { Step } from '@openfn/lexicon';

let idGen = 0;

// builders
const b = {
  step: (id, props: Parital<Step> = {}) => ({
    id,
    openfn: { uuid: ++idGen },
    ...props,
  }),
  project: (steps = []) =>
    new Project({
      workflows: [
        {
          id: 'w',
          steps,
        },
      ],
    }),
};

test("getUuidForStep: throw if workflow doesn't exist", (t) => {
  const proj = b.project();

  t.throws(() => getUuidForStep(proj, 'xxx', 'a'));
});

test('getUuidForStep: should return null if there are no steps', (t) => {
  const proj = b.project();

  const result = getUuidForStep(proj, 'w', 'a');
  t.is(result, null);
});

test('getUuidForStep: should return null if a matching step does not exist', (t) => {
  const proj = b.project([b.step('a'), b.step('b')]);

  const result = getUuidForStep(proj, 'w', 'z');
  t.is(result, null);
});

test('getUuidForStep: should get a UUID for a step', (t) => {
  const target = b.step('b');
  const proj = b.project([b.step('a'), target, b.step('c')]);

  const result = getUuidForStep(proj, 'w', 'b');
  t.is(result, target.openfn.uuid);
});

test("getUuidForEdge: throw if workflow doesn't exist", (t) => {
  const proj = b.project();

  t.throws(() => getUuidForStep(proj, 'xxx', 'a', 'b'));
});

test('getUuidForEdge: should return null if there are no steps', (t) => {
  const proj = b.project();

  const result = getUuidForEdge(proj, 'w', 'a', 'b');
  t.is(result, null);
});

test('getUuidForEdge: should return null if no edge exists', (t) => {
  const x = b.step('x', {
    next: {
      y: {
        condition: true,
        openfn: {
          uuid: 'x-y',
        },
      },
    },
  });
  const y = b.step('y');
  const proj = b.project([x, y]);

  const result = getUuidForEdge(proj, 'w', 'a', 'b');
  t.is(result, null);
});

test('getUuidForEdge: should get a UUID for an edge', (t) => {
  const x = b.step('x', {
    next: {
      y: {
        condition: true,
        openfn: {
          uuid: 'x-y',
        },
      },
    },
  });
  const y = b.step('y');
  const proj = b.project([x, y]);

  const result = getUuidForEdge(proj, 'w', 'x', 'y');
  t.is(result, 'x-y');
});
