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
              uuid: 1,
            },
          },
        },
        openfn: {
          uuid: 2,
        },
      },
      {
        id: 'b',
        openfn: {
          uuid: 3,
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
              uuid: 1,
            },
          },
        },
        openfn: {
          uuid: 2,
        },
      },
      {
        id: 'child',
        openfn: {
          uuid: 3,
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
              uuid: 1,
            },
          },
          c: {
            openfn: {
              uuid: 4,
            },
          },
        },
        openfn: {
          uuid: 2,
        },
      },
      {
        id: 'b',
        openfn: {
          uuid: 3,
        },
      },
      {
        id: 'c',
        openfn: {
          uuid: 5,
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
              uuid: 1,
            },
          },
        },
        openfn: {
          uuid: 2,
        },
      },
      {
        id: 'b',
        next: {
          a: {
            openfn: {
              uuid: 4,
            },
          },
        },
        openfn: {
          uuid: 3,
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
              uuid: 1,
            },
          },
        },
        openfn: {
          uuid: 2,
        },
      },
      {
        id: 'b',
        openfn: {
          uuid: 3,
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

  t.deepEqual(wf.workflow, {
    name: 'workflow',
    steps: [
      {
        id: 'a',
        next: {
          b: {
            openfn: {
              uuid: 1,
            },
          },
          c: {
            openfn: {
              uuid: 4,
            },
          },
          f: {
            openfn: {
              uuid: 12,
            },
          },
        },
        openfn: {
          uuid: 2,
        },
      },
      {
        id: 'b',
        openfn: {
          uuid: 3,
        },
      },
      {
        id: 'c',
        next: {
          d: {
            openfn: {
              uuid: 6,
            },
          },
          e: {
            openfn: {
              uuid: 8,
            },
          },
          f: {
            openfn: {
              uuid: 10,
            },
          },
        },
        openfn: {
          uuid: 5,
        },
      },
      {
        id: 'd',
        openfn: {
          uuid: 7,
        },
      },
      {
        id: 'e',
        next: {
          a: {
            openfn: {
              uuid: 13,
            },
          },
          f: {
            openfn: {
              uuid: 14,
            },
          },
        },
        openfn: {
          uuid: 9,
        },
      },
      {
        id: 'f',
        openfn: {
          uuid: 11,
        },
      },
    ],
  });
});
