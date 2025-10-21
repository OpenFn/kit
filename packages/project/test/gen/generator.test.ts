import test from 'ava';
import { grammar } from 'ohm-js';
import _ from 'lodash';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { generateWorkflow, generateProject } from '../../src/gen/generator';
import * as fixtures from './fixtures';
import Workflow from '../../src/Workflow';

// Generate a workflow with a fixed UUID seed
// Pass test context to log the result
const gen = (src, t, options = {}) => {
  const result = generateWorkflow(src, {
    uuidSeed: 1,
    printErrors: false,
    ...options,
  });
  if (t) {
    t.log(JSON.stringify(result.toJSON(), null, 2));
  }
  return result.toJSON();
};

test('it should generate a simple workflow', (t) => {
  const result = gen('a-b', t);

  t.deepEqual(result, fixtures.ab);
});

test('it should return a Workflow instance', (t) => {
  const result = generateWorkflow('a-b');

  t.true(result instanceof Workflow);
});

test('it should generate a simple project', (t) => {
  const result = generateProject('danko jones', ['a-b'], { uuidSeed: 1 });
  t.is(result.name, 'danko jones');
  t.deepEqual(result.workflows[0].toJSON(), fixtures.ab);
});

test('it should generate a simple workflow with an attribute', (t) => {
  const result = gen(
    `@name joe
a-b`,
    t
  );

  const expected = {
    ...fixtures.ab,
    name: 'joe',
  };

  t.deepEqual(result, expected);
});

test('it should generate a simple workflow with an attribute with underscores and dashes', (t) => {
  const result = gen(
    `@name a_c-x
a-b`,
    t
  );

  const expected = {
    ...fixtures.ab,
    name: 'a_c-x',
  };

  t.deepEqual(result, expected);
});

test('it should generate a simple workflow with two attributes', (t) => {
  const result = gen(
    `@x 1
@y 2
a-b`,
    t
  );

  const expected = {
    ...fixtures.ab,
    x: '1',
    y: '2',
  };

  t.deepEqual(result, expected);
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

test('it should generate a simple workflow with leading space', (t) => {
  const result = gen(' a-b');
  t.deepEqual(result, fixtures.ab);
});

test('it should generate a simple workflow with trailing space', (t) => {
  const result = gen('a-b ');
  t.deepEqual(result, fixtures.ab);
});

test("it should fail if there's a space on an edge", (t) => {
  const result = gen('a -b');
  t.throws(() => gen('a-'), {
    message: /parsing failed!/i,
  });
});

test('it should generate a simple workflow with any letter', (t) => {
  const result = gen('x-y', t);
  const expected = {
    id: 'workflow',
    name: 'Workflow',
    steps: [
      {
        id: 'x',
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
        id: 'y',
        name: 'y',
        openfn: {
          uuid: 2,
        },
      },
    ],
  };
  t.deepEqual(result, expected);
});

test('it should generate a simple workflow with words, numbers and underscores', (t) => {
  const result = gen('node_1-_node_2_', t);
  const expected = {
    id: 'workflow',
    name: 'Workflow',
    steps: [
      {
        id: 'node_1',
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
        id: '_node_2_',
        name: '_node_2_',
        openfn: {
          uuid: 2,
        },
      },
    ],
  };
  t.deepEqual(result, expected);
});

test('it should generate two node pairs', (t) => {
  const result = gen('a-b b-c', t);
  const expected = {
    id: 'workflow',
    name: 'Workflow',
    steps: [
      {
        id: 'a',
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
        id: 'b',
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
        id: 'c',
        name: 'c',
        openfn: {
          uuid: 4,
        },
      },
    ],
  };

  t.deepEqual(result, expected);
});

test('it should generate two node pairs from one parent', (t) => {
  const result = gen('a-b a-c', t);
  const expected = {
    id: 'workflow',
    name: 'Workflow',
    steps: [
      {
        id: 'a',
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
        id: 'b',
        name: 'b',
        openfn: {
          uuid: 2,
        },
      },
      {
        id: 'c',
        name: 'c',
        openfn: {
          uuid: 4,
        },
      },
    ],
  };

  t.deepEqual(result, expected);
});

test('it should generate several node pairs', (t) => {
  const result = gen('a-b b-c b-d a-x', t);
  const expected = {
    id: 'workflow',
    name: 'Workflow',
    steps: [
      {
        id: 'a',
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
        id: 'b',
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
        id: 'c',
        name: 'c',
        openfn: {
          uuid: 4,
        },
      },
      {
        id: 'd',
        name: 'd',
        openfn: {
          uuid: 6,
        },
      },
      {
        id: 'x',
        name: 'x',
        openfn: {
          uuid: 8,
        },
      },
    ],
  };

  t.deepEqual(result, expected);
});

test('it should generate a node with a prop', (t) => {
  const result = gen('a(x=y)-b', t);
  const expected = _.cloneDeep(fixtures.ab);
  expected.steps[0].x = 'y';

  t.deepEqual(result, expected);
});

test('it should generate a node with two props', (t) => {
  const result = gen('a(x=1,z=2)-b', t);
  const expected = _.cloneDeep(fixtures.ab);
  expected.steps[0].x = '1';
  expected.steps[0].z = '2';

  t.deepEqual(result, expected);
});

test('it should treat quotes specially', (t) => {
  const result = gen('a(expression="fn()")-b', t);
  const expected = _.cloneDeep(fixtures.ab);
  expected.steps[0].expression = 'fn()';

  t.deepEqual(result, expected);
});

test('it should ignore leading comments', (t) => {
  const result = gen(
    `#test
a-b`,
    t
  );

  t.deepEqual(result, fixtures.ab);
});

test('it should ignore trailing comments', (t) => {
  const result = gen(
    `a-b
#test`,
    t
  );

  t.deepEqual(result, fixtures.ab);
});

test('it should ignore multiple leading comments', (t) => {
  const result = gen(
    `#xxx
#yyy
a-b
`,
    t
  );

  t.deepEqual(result, fixtures.ab);
});

test('it should ignore EOL comments', (t) => {
  const result = gen(`a-b # test`, t);

  t.deepEqual(result, fixtures.ab);
});

test('it should ignore comments with nodes', (t) => {
  const result = gen(
    `#x-y
a-b`,
    t
  );

  t.deepEqual(result, fixtures.ab);
});

test('it should ignore mixed comments', (t) => {
  const result = gen(
    `#test
#xxx
a-b #zz
#lll`,
    t
  );

  t.deepEqual(result, fixtures.ab);
});

test('it should generate a simple workflow with mapped uuids', (t) => {
  const result = gen('a-b', t, {
    uuidMap: {
      a: 'A',
      b: 'B',
      'a-b': 'AB',
    },
  });

  const expected = {
    id: 'workflow',
    name: 'Workflow',
    steps: [
      {
        id: 'a',
        name: 'a',
        openfn: {
          uuid: 'A',
        },
        next: {
          b: {
            openfn: {
              uuid: 'AB',
            },
          },
        },
      },
      {
        id: 'b',
        name: 'b',
        openfn: {
          uuid: 'B',
        },
      },
    ],
  };

  t.deepEqual(result, expected);
});

test('it should generate a project with uuids', (t) => {
  const result = generateProject('x', ['a-b'], {
    uuidMap: [
      {
        a: 'A',
        b: 'B',
        'a-b': 'AB',
      },
    ],
  });

  const expected = {
    id: 'workflow',
    name: 'Workflow',
    steps: [
      {
        id: 'a',
        name: 'a',
        openfn: {
          uuid: 'A',
        },
        next: {
          b: {
            openfn: {
              uuid: 'AB',
            },
          },
        },
      },
      {
        id: 'b',
        name: 'b',
        openfn: {
          uuid: 'B',
        },
      },
    ],
  };

  t.deepEqual(result.workflows[0].toJSON(), expected);
});

test('it should generate a project with options', (t) => {
  const options = {
    color: '#f00',
    concurrency: 1,
    scheduled_deletion: null,
    history_retention_period: 90,
    dataclip_retention_period: 12,
    retention_policy: 'retain_all',
    version_history: ['abc'],
    allow_support_access: false,
    requires_mfa: false,
  };

  const result = generateProject('x', ['a-b'], {
    options,
  });

  t.deepEqual(result.options, options);
});
