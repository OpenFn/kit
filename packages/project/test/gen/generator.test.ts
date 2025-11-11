import test, { ExecutionContext } from 'ava';
import _ from 'lodash';
import { generateWorkflow, generateProject } from '../../src/gen/generator';
import * as fixtures from './fixtures';
import Workflow from '../../src/Workflow';

// Generate a workflow with a fixed UUID seed
// Pass test context to log the result
const gen = (src: string, t: ExecutionContext<unknown>, options = {}) => {
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

test('it should generate a workflow with an attribute', (t) => {
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

test('it should generate a workflow with an attribute with underscores and dashes', (t) => {
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

test('it should generate a workflow with two attributes', (t) => {
  const result = gen(
    `@x x
@y y
a-b`,
    t
  );

  const expected = {
    ...fixtures.ab,
    x: 'x',
    y: 'y',
  };

  t.deepEqual(result, expected);
});

test('it should generate a workflow with nested attributes', (t) => {
  const result = gen(
    `@x.y jam
a-b`,
    t
  );

  const expected = {
    ...fixtures.ab,
    x: { y: 'jam' },
  };

  t.deepEqual(result, expected);
});

test('it should generate a workflow with typed attributes (number, boolean)', (t) => {
  const result = gen(
    `@somebool false
@somenum 61
a-b`,
    t
  );

  const expected = {
    ...fixtures.ab,
    somebool: false,
    somenum: 61,
  };

  t.deepEqual(result, expected);
});

// TODO: it shouldn't really be necessary to quote the date here?
test('it should generate a workflow with openfn meta', (t) => {
  const result = gen(
    `@openfn.lock_version 123
@openfn.concurrency 3
@openfn.updated_at "2025-04-23T11:19:32Z"
@openfn.jam jar 
a-b`,
    t
  );
  t.log(result);
  t.deepEqual(result.openfn, {
    lock_version: 123,
    concurrency: 3,
    updated_at: '2025-04-23T11:19:32Z',
    jam: 'jar',
  });
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
    history: [],
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
    history: [],
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
    history: [],
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
    history: [],
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
    history: [],
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

test('it should generate a node with a prop with an underscore', (t) => {
  const result = gen('a(project_credential_id=y)-b', t);
  const expected = _.cloneDeep(fixtures.ab);
  expected.steps[0].project_credential_id = 'y';

  t.deepEqual(result, expected);
});

test('it should generate a node with two props', (t) => {
  const result = gen('a(x=j,z=k)-b', t);
  const expected = _.cloneDeep(fixtures.ab);
  expected.steps[0].x = 'j';
  expected.steps[0].z = 'k';

  t.deepEqual(result, expected);
});

test('it should treat quotes specially', (t) => {
  const result = gen('a(expression="fn()")-b', t);
  const expected = _.cloneDeep(fixtures.ab);
  expected.steps[0].expression = 'fn()';

  t.deepEqual(result, expected);
});

test('it should generate an edge with a prop', (t) => {
  const result = gen('a-(x=y)-b', t);

  const edge = result.steps[0].next.b;
  t.deepEqual(edge, {
    openfn: {
      uuid: 3,
    },
    x: 'y',
  });
});

test('it should generate an edge with a multi-char prop', (t) => {
  const result = gen('a-(condition=false)-b', t);

  const edge = result.steps[0].next.b;
  t.deepEqual(edge, {
    openfn: {
      uuid: 3,
    },
    condition: false,
  });
});

test('it should generate an edge with multiple props', (t) => {
  const result = gen('a-(x=y,foo=bar)-b', t);

  const edge = result.steps[0].next.b;
  t.deepEqual(edge, {
    openfn: {
      uuid: 3,
    },
    x: 'y',
    foo: 'bar',
  });
});

test('it should parse node property values as boolean', (t) => {
  const result = gen('a(t=true,f=false)-b', t);

  const [step] = result.steps;
  t.true(step.t);
  t.false(step.f);
});

test('it should parse edge property values as boolean', (t) => {
  const result = gen('a-(t=true,f=false)-b', t);

  const edge = result.steps[0].next.b;
  t.true(edge.t);
  t.false(edge.f);
});

test('it should parse node property values as numbers', (t) => {
  const result = gen('a(x=22,z=0)-b', t);

  const [step] = result.steps;
  t.is(step.x, 22);
  t.is(step.z, 0);
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

test('it should generate a project with seeded uuids', (t) => {
  const result = generateProject('x', ['a-b'], {
    openfnUuid: true,
    uuidSeed: 1000,
    uuid: 123,
  });

  const expected = {
    id: 'workflow',
    name: 'Workflow',
    history: [],
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
  t.deepEqual(result.openfn, {
    uuid: 123,
  });

  t.deepEqual(result.workflows[0].openfn.uuid, 1000);
  t.deepEqual(result.workflows[0].steps[0].openfn.uuid, 1001);
  t.deepEqual(result.workflows[0].steps[1].openfn.uuid, 1002);
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
    history: [],
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

test('it should generate a project with mapped uuids', (t) => {
  const result = generateProject('x', ['a-b'], {
    openfnUuid: true,
    uuidMap: [
      {
        a: 'A',
        b: 'B',
        'a-b': 'AB',
        workflow: 'W',
      },
    ],
  });

  const expected = {
    id: 'workflow',
    name: 'Workflow',
    history: [],
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
    openfn: {
      uuid: 'W',
    },
  };

  t.deepEqual(result.workflows[0].toJSON(), expected);
});
