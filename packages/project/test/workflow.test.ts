import { randomUUID } from 'node:crypto';
import test from 'ava';
import Workflow from '../src/Workflow';

const simpleWorkflow = {
  id: 'wf1',
  name: 'My Workflow',
  steps: [
    {
      id: 'a',
      expression: 'fn(s => s)',
      next: {
        c: {
          condition: true,
          openfn: {
            id: randomUUID(),
          },
        },
      },
      openfn: {
        id: randomUUID(),
      },
    },
    {
      id: 'b',
      expression: 'fn(s => s)',
      next: {
        c: {
          condition: false,
          openfn: {
            id: randomUUID(),
          },
        },
      },
      openfn: {
        id: randomUUID(),
      },
    },
    {
      id: 'c',
      expression: 'fn(s => s)',
      openfn: {
        id: randomUUID(),
      },
    },
  ],
  openfn: {
    id: randomUUID(),
  },
};

test('create a Workflow from json', (t) => {
  const w = new Workflow(simpleWorkflow);

  t.is(w.steps.length, 3);
  t.falsy(w.workflow);
});

test('a Workflow class behaves just like regular json', (t) => {
  const w = new Workflow(simpleWorkflow);

  t.is(w.id, 'wf1');
  t.is(w.name, 'My Workflow');
  t.is(w.steps.length, 3);

  t.is(w.steps[0].id, 'a');
  t.is(w.steps[1].id, 'b');
  t.is(w.steps[2].id, 'c');
});

test('a Workflow class can serialize to JSON', (t) => {
  const w = new Workflow(simpleWorkflow);
  const json = w.toJSON();

  t.deepEqual(json, simpleWorkflow);
});

test.skip("Editing a workflow internally doesn't affect the input", (t) => {
  const w = new Workflow(simpleWorkflow);

  // set a property on w
  // simple workflow should not reflect the change

  t.deepEqual(json, simpleWorkflow);
});

test('map steps by id', (t) => {
  const w = new Workflow(simpleWorkflow);

  t.deepEqual(w.index.steps['a'], simpleWorkflow.steps[0]);
  t.deepEqual(w.index.steps['b'], simpleWorkflow.steps[1]);
  t.deepEqual(w.index.steps['c'], simpleWorkflow.steps[2]);
});

test('map edges by name', (t) => {
  const w = new Workflow(simpleWorkflow);

  t.deepEqual(w.index.edges['a-c'], simpleWorkflow.steps[0].next.c);
  t.deepEqual(w.index.edges['b-c'], simpleWorkflow.steps[1].next.c);
});

test('map ids to uuids', (t) => {
  const w = new Workflow(simpleWorkflow);

  t.deepEqual(w.index.uuid['a'], simpleWorkflow.steps[0].openfn.id);
  t.deepEqual(w.index.uuid['b'], simpleWorkflow.steps[1].openfn.id);
  t.deepEqual(w.index.uuid['c'], simpleWorkflow.steps[2].openfn.id);
  t.deepEqual(w.index.uuid['a-c'], simpleWorkflow.steps[0].next.c.openfn.id);
  t.deepEqual(w.index.uuid['b-c'], simpleWorkflow.steps[1].next.c.openfn.id);
});

test('map uuids to ids', (t) => {
  const w = new Workflow(simpleWorkflow);

  const uuid_a = simpleWorkflow.steps[0].openfn.id;
  const uuid_b = simpleWorkflow.steps[1].openfn.id;
  const uuid_c = simpleWorkflow.steps[2].openfn.id;
  const uuid_ac = simpleWorkflow.steps[0].next.c.openfn.id;
  const uuid_bc = simpleWorkflow.steps[1].next.c.openfn.id;

  t.deepEqual(w.index.id[uuid_a], 'a');
  t.deepEqual(w.index.id[uuid_b], 'b');
  t.deepEqual(w.index.id[uuid_c], 'c');
  t.deepEqual(w.index.id[uuid_ac], 'a-c');
  t.deepEqual(w.index.id[uuid_bc], 'b-c');
});
