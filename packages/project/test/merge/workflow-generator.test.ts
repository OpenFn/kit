import test from 'ava';

import generateWorkflow from './workflow-generator';

test('should generate a simple workflow with uuids', (t) => {
  const wf = generateWorkflow(['a-b'], { uuidSeed: 0 });

  t.deepEqual(wf.workflow, {
    name: 'workflow',
    steps: [
      {
        id: 'a',
        next: {
          b: {
            openfn: {
              id: 1,
            },
          },
        },
        openfn: {
          id: 2,
        },
      },
      {
        id: 'b',
        next: {},
        openfn: {
          id: 3,
        },
      },
    ],
  });
});

test('should support long node ids', (t) => {
  const wf = generateWorkflow(['parent-child'], { uuidSeed: 0 });

  t.deepEqual(wf.workflow, {
    name: 'workflow',
    steps: [
      {
        id: 'parent',
        next: {
          child: {
            openfn: {
              id: 1,
            },
          },
        },
        openfn: {
          id: 2,
        },
      },
      {
        id: 'child',
        next: {},
        openfn: {
          id: 3,
        },
      },
    ],
  });
});

test('should generate two children for one node', (t) => {
  const wf = generateWorkflow(['a-b', 'a-c'], { uuidSeed: 0 });

  t.deepEqual(wf.workflow, {
    name: 'workflow',
    steps: [
      {
        id: 'a',
        next: {
          b: {
            openfn: {
              id: 1,
            },
          },
          c: {
            openfn: {
              id: 4,
            },
          },
        },
        openfn: {
          id: 2,
        },
      },
      {
        id: 'b',
        next: {},
        openfn: {
          id: 3,
        },
      },
      {
        id: 'c',
        next: {},
        openfn: {
          id: 5,
        },
      },
    ],
  });
});

test("should generate circular references even though that's illegal", (t) => {
  const wf = generateWorkflow(['a-b', 'b-a'], { uuidSeed: 0 });

  t.deepEqual(wf.workflow, {
    name: 'workflow',
    steps: [
      {
        id: 'a',
        next: {
          b: {
            openfn: {
              id: 1,
            },
          },
        },
        openfn: {
          id: 2,
        },
      },
      {
        id: 'b',
        next: {
          a: {
            openfn: {
              id: 4,
            },
          },
        },
        openfn: {
          id: 3,
        },
      },
    ],
  });
});

test('should ignore duplicates', (t) => {
  const wf = generateWorkflow(['a-b', 'a-b'], { uuidSeed: 0 });

  t.deepEqual(wf.workflow, {
    name: 'workflow',
    steps: [
      {
        id: 'a',
        next: {
          b: {
            openfn: {
              id: 1,
            },
          },
        },
        openfn: {
          id: 2,
        },
      },
      {
        id: 'b',
        next: {},
        openfn: {
          id: 3,
        },
      },
    ],
  });
});

test('should generate a complex workflow', (t) => {
  const wf = generateWorkflow(
    ['a-b', 'a-c', 'c-d', 'c-e', 'c-f', 'a-f', 'e-a', 'e-f'],
    { uuidSeed: 0 }
  );

  t.log(JSON.stringify(wf.workflow, null, 2));

  t.deepEqual(wf.workflow, {
    name: 'workflow',
    steps: [
      {
        id: 'a',
        next: {
          b: {
            openfn: {
              id: 1,
            },
          },
          c: {
            openfn: {
              id: 4,
            },
          },
          f: {
            openfn: {
              id: 12,
            },
          },
        },
        openfn: {
          id: 2,
        },
      },
      {
        id: 'b',
        next: {},
        openfn: {
          id: 3,
        },
      },
      {
        id: 'c',
        next: {
          d: {
            openfn: {
              id: 6,
            },
          },
          e: {
            openfn: {
              id: 8,
            },
          },
          f: {
            openfn: {
              id: 10,
            },
          },
        },
        openfn: {
          id: 5,
        },
      },
      {
        id: 'd',
        next: {},
        openfn: {
          id: 7,
        },
      },
      {
        id: 'e',
        next: {
          a: {
            openfn: {
              id: 13,
            },
          },
          f: {
            openfn: {
              id: 14,
            },
          },
        },
        openfn: {
          id: 9,
        },
      },
      {
        id: 'f',
        next: {},
        openfn: {
          id: 11,
        },
      },
    ],
  });
});
