import * as l from '@openfn/lexicon';

import test from 'ava';
import mapUUIDs from '../../src/merge/map-uuids';
import { createWorkflow } from '../util';
import { randomUUID } from 'node:crypto';

const uuid = randomUUID;

interface TStep {
  id: string,
  type?: string,
  next: TStep[]
}
interface TWorkflow {
  name: string,
  steps: TStep[]
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
        id
      },
      next
    })
  }
  for (const step of gn.steps) generate(step);
  return {
    workflow: { name: gn.name, steps: steps.reverse() },
    getId(id: string) {
      return idMap.get(id);
    }
  }
}

const wf = (steps = []): l.Workflow => ({
  name: 'wf1',
  steps,
});

test('map triggers with the same name', (t) => {
  const wf1 = workflowGenerator({
    name: "initial workflow",
    steps: [
      { id: 'trigger', type: 'webhook' }
    ]
  })

  const wf2 = workflowGenerator({
    name: "initial workflow",
    steps: [
      { id: 'trigger', type: 'webhook' }
    ]
  })
  const result = mapUUIDs(wf1.workflow, wf2.workflow);
  t.deepEqual(result, {
    [wf1.getId('trigger')]: wf2.getId('trigger'),
  });
});

// map steps with the same name
// map edges with the same name

// map step with different id but same parent
// mark new step as new
// mark removed step as removed

test('node name changes but no positional change', (t) => {
  const wf1 = workflowGenerator({
    name: "initial workflow",
    steps: [
      {
        id: 'trigger', type: 'webhook',
        next: [
          {
            id: 'a',
            next: [{ id: 'b' }]
          }
        ]
      }
    ]
  })

  const wf2 = workflowGenerator({
    name: "updated workflow",
    steps: [
      {
        id: 'trigger', type: 'webhook',
        next: [
          {
            id: 'c',
            next: [{ id: 'b' }]
          }
        ]
      }
    ]
  })

  const result = mapUUIDs(wf1.workflow, wf2.workflow);

  t.deepEqual(result, {
    [wf1.getId('a')]: wf2.getId('c'),
  });
});

test('node parent lost', (t) => {
  const workflow1: TWorkflow = {
    name: "Some workflow",
    steps: [
      {
        id: 'a',
        next: [
          {
            id: 'b',
            next: [
              { id: 'c' },
              { id: 'd' }
            ]
          }
        ]
      }
    ]
  }
  const workflow2: TWorkflow = {
    name: "Updated workflow",
    steps: [
      {
        id: 'a',
        next: [
          {
            id: 'z',
            next: [
              {
                id: 'b',
                next: [
                  { id: 'c' },
                  { id: 'd' }
                ]
              }
            ]
          }
        ]
      }
    ]
  }

  const wf1 = workflowGenerator(workflow1);
  const wf2 = workflowGenerator(workflow2);

  const result = mapUUIDs(wf1.workflow, wf2.workflow);
  t.deepEqual(result, {
    [wf1.getId('a')]: wf2.getId('z'),
    [wf1.getId('c')]: wf2.getId('c'),
  });
});