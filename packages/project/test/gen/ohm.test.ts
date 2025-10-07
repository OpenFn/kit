// TODO this should wholesale replace workflow-generator.test.ts
import test from 'ava';
import { grammar } from 'ohm-js';
import _ from 'lodash';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import generateWorkflow from '../../src/gen/workflow-generator';
import * as fixtures from './fixtures';

const printResults = true; // TODO load this from env or something

const print = (t, result) => {};

// Generate a workflow with a fixed UUID seed
// Pass test context to log the result
const gen = (src, t) => {
  const result = generateWorkflow(src, { uuidSeed: 1, printErrors: false });
  if (t) {
    t.log(JSON.stringify(result, null, 2));
  }
  return result;
};

test('it should parse a simple workflow', (t) => {
  const result = gen('a-b', t);

  t.deepEqual(result, fixtures.ab);
});

test('it should throw if parsing fails with 1 node, 1 edge', (t) => {
  t.throws(() => gen('a-'), {
    message: /parsing failed!/i,
  });
});

test('it should throw if parsing fails with 2 nodes, 0 edges', (t) => {
  t.throws(() => gen('a b'), {
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

test("it should fail if there's a space on an edge", (t) => {
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

test('it should parse two node pairs', (t) => {
  const result = gen('a-b b-c', t);
  const expected = {
    steps: [
      {
        name: 'a',
        openfn: {
          uuid: 1,
        },
        next: {
          b: {
            openfn: {
              uuid: 3,
            },
          },
        },
      },
      {
        name: 'b',
        openfn: {
          uuid: 2,
        },
        next: {
          c: {
            openfn: {
              uuid: 5,
            },
          },
        },
      },
      {
        name: 'c',
        openfn: {
          uuid: 4,
        },
      },
    ],
  };

  t.deepEqual(result, expected);
});

test('it should parse two node pairs from one parent', (t) => {
  const result = gen('a-b a-c', t);
  const expected = {
    steps: [
      {
        name: 'a',
        openfn: {
          uuid: 1,
        },
        next: {
          b: {
            openfn: {
              uuid: 3,
            },
          },
          c: {
            openfn: {
              uuid: 5,
            },
          },
        },
      },
      {
        name: 'b',
        openfn: {
          uuid: 2,
        },
      },
      {
        name: 'c',
        openfn: {
          uuid: 4,
        },
      },
    ],
  };

  t.deepEqual(result, expected);
});

test('it should parse several node pairs', (t) => {
  const result = gen('a-b b-c b-d a-x', t);
  const expected = {
    steps: [
      {
        name: 'a',
        openfn: {
          uuid: 1,
        },
        next: {
          b: {
            openfn: {
              uuid: 3,
            },
          },
          x: {
            openfn: {
              uuid: 9,
            },
          },
        },
      },
      {
        name: 'b',
        openfn: {
          uuid: 2,
        },
        next: {
          c: {
            openfn: {
              uuid: 5,
            },
          },
          d: {
            openfn: {
              uuid: 7,
            },
          },
        },
      },
      {
        name: 'c',
        openfn: {
          uuid: 4,
        },
      },
      {
        name: 'd',
        openfn: {
          uuid: 6,
        },
      },
      {
        name: 'x',
        openfn: {
          uuid: 8,
        },
      },
    ],
  };

  t.deepEqual(result, expected);
});

test('it should parse a node with a prop', (t) => {
  const result = gen('a(x=y)-b', t);
  const expected = _.cloneDeep(fixtures.ab);
  expected.steps[0].x = 'y';

  t.deepEqual(result, expected);
});

test('it should parse a node with two props', (t) => {
  const result = gen('a(x=1,z=2)-b', t);
  const expected = _.cloneDeep(fixtures.ab);
  expected.steps[0].x = '1';
  expected.steps[0].z = '2';

  t.deepEqual(result, expected);
});
