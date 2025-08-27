import * as l from '@openfn/lexicon';

import test from 'ava';
import mapUUIDs from '../../src/merge/map-uuids';
import { createWorkflow } from '../util';
import { randomUUID } from 'node:crypto';

const uuid = randomUUID;

interface TStep {
  id: string;
  type?: string;
  next: TStep[];
}
interface TWorkflow {
  name: string;
  steps: TStep[];
}
function workflowGenerator(gn: TWorkflow) {
  const steps = [];
  const idMap = new Map<string, string>();
  // do something
  const generate = (stp: TStep) => {
    const id = uuid();
    idMap.set(stp.id, id);
    const next = {};
    if (stp.next) {
      for (const step of stp.next) {
        next[step.id] = true;
        generate(step);
      }
    }
    steps.push({
      id: stp.id,
      openfn: {
        id,
      },
      next,
    });
  };
  for (const step of gn.steps) generate(step);
  return {
    workflow: { name: gn.name, steps: steps.reverse() },
    getId(id: string) {
      return idMap.get(id);
    },
  };
}

const wf = (steps = []): l.Workflow => ({
  name: 'wf1',
  steps,
});

test('map triggers with the same name', (t) => {
  const source = workflowGenerator({
    name: 'initial workflow',
    steps: [{ id: 'trigger', type: 'webhook' }],
  });

  const target = workflowGenerator({
    name: 'initial workflow',
    steps: [{ id: 'trigger', type: 'webhook' }],
  });
  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result, {
    ['trigger']: target.getId('trigger'),
  });
});

// map steps with the same name
// map edges with the same name

// map step with different id but same parent
// mark new step as new
// mark removed step as removed

test('node name changes but no positional change', (t) => {
  const source = workflowGenerator({
    name: 'initial workflow',
    steps: [
      {
        id: 'trigger',
        type: 'webhook',
        next: [
          {
            id: 'a',
            next: [{ id: 'b' }],
          },
        ],
      },
    ],
  });

  const target = workflowGenerator({
    name: 'updated workflow',
    steps: [
      {
        id: 'trigger',
        type: 'webhook',
        next: [
          {
            id: 'c',
            next: [{ id: 'b' }],
          },
        ],
      },
    ],
  });

  const result = mapUUIDs(source.workflow, target.workflow);

  t.deepEqual(result, {
    ['trigger']: target.getId('trigger'),
    ['b']: target.getId('b'),
    ['c']: null,
    ['a']: true,
  });
});

test('one connecting node missing', (t) => {
  const source = workflowGenerator({
    name: 'Some workflow',
    steps: [
      {
        id: 'a',
        next: [
          {
            id: 'b',
            next: [{ id: 'c' }, { id: 'd' }],
          },
        ],
      },
    ],
  });
  const target = workflowGenerator({
    name: 'Updated workflow',
    steps: [
      {
        id: 'a',
        next: [
          {
            id: 'z',
            next: [
              {
                id: 'b',
                next: [{ id: 'c' }, { id: 'd' }],
              },
            ],
          },
        ],
      },
    ],
  });

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result, {
    ['a']: target.getId('a'),
    ['b']: target.getId('b'),
    ['c']: target.getId('c'),
    ['d']: target.getId('d'),
    ['z']: null,
  });
});
