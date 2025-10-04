// TODO this should wholesale replace workflow-generator.test.ts
import test from 'ava';
import { grammar } from 'ohm-js';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import generateWorkflow from '../../src/gen/workflow-generator';
import * as fixtures from './fixtures';

const printResults = true; // TODO load this from env or something

const print = (t, result) => {};

// Generate a workflow with a fixed UUID seed
// Pass test context to log the result
const gen = (src, t) => {
  const result = generateWorkflow(src, { uuidSeed: 1 });
  if (t) {
    t.log(JSON.stringify(result, null, 2));
  }
  return result;
};

test('it should parse a simple workflow', (t) => {
  const result = gen('a-b');

  t.deepEqual(result, fixtures.ab);
});

test('it should throw if parsing fails', (t) => {
  t.throws(() => gen('a-'), {
    message: /parsing failed!/i,
  });
});

test('it should parse a simple workflow with leading space', (t) => {
  const result = gen(' a-b');
  t.deepEqual(result, fixtures.ab);
});

test('it should parse a simple workflow with trailing space', (t) => {
  const result = gen('a-b ');
  t.deepEqual(result, fixtures.ab);
});

// don't understand why this one is failing
test.skip("it should fail if there's a space on an edge", (t) => {
  const result = gen('a -b');
  t.throws(() => gen('a-'), {
    message: /parsing failed!/i,
  });
});

test('it should parse a simple workflow with any letter', (t) => {
  const result = gen('x-y', t);
  const expected = {
    steps: [
      {
        name: 'x',
        openfn: {
          uuid: 1,
        },
        next: {
          y: {
            openfn: {
              uuid: 3,
            },
          },
        },
      },
      {
        name: 'y',
        openfn: {
          uuid: 2,
        },
      },
    ],
  };
  t.deepEqual(result, expected);
});

test('it should parse a simple workflow with words, numbers and underscores', (t) => {
  const result = gen('node_1-_node_2_', t);
  const expected = {
    steps: [
      {
        name: 'node_1',
        openfn: {
          uuid: 1,
        },
        next: {
          _node_2_: {
            openfn: {
              uuid: 3,
            },
          },
        },
      },
      {
        name: '_node_2_',
        openfn: {
          uuid: 2,
        },
      },
    ],
  };
  t.deepEqual(result, expected);
});

// Come back to this later
test.skip('it should parse two node pairs', (t) => {
  const result = gen('a-b x-y');
  t.true(result.succeeded());
});
