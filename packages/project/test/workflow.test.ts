import { randomUUID } from 'node:crypto';
import test from 'ava';
import Workflow from '../src/Workflow';

const simpleWorkflow = {
  name: 'My Workflow',
  steps: [
    {
      id: 'a',
      expression: 'fn(s => s)',
      next: {
        c: {
          condition: true,
          openfn: {
            uuid: randomUUID(),
          },
        },
      },
      openfn: {
        uuid: randomUUID(),
      },
    },
    {
      id: 'b',
      expression: 'fn(s => s)',
      next: {
        c: {
          condition: false,
          openfn: {
            uuid: randomUUID(),
          },
        },
      },
      openfn: {
        uuid: randomUUID(),
      },
    },
    {
      id: 'c',
      expression: 'fn(s => s)',
      openfn: {
        uuid: randomUUID(),
      },
    },
  ],
  openfn: {
    uuid: randomUUID(),
  },
};

test('create a Workflow from json', (t) => {
  const w = new Workflow(simpleWorkflow);

  t.is(w.steps.length, 3);
  t.truthy(w.workflow.steps);
});

test('a Workflow class behaves just like regular json', (t) => {
  const w = new Workflow(simpleWorkflow);

  t.is(w.name, 'My Workflow');
  t.is(w.steps.length, 3);

  t.is(w.steps[0].id, 'a');
  t.is(w.steps[1].id, 'b');
  t.is(w.steps[2].id, 'c');
});

test('a Workflow class will generate an ID from the name', (t) => {
  const w = new Workflow(simpleWorkflow);

  t.is(w.id, 'my-workflow');
});

test('a Workflow class will prefer an id passed explicitly', (t) => {
  const w = new Workflow({
    ...simpleWorkflow,
    id: '1234',
  });

  t.is(w.id, '1234');
});

test('a Workflow class will preserve openfn metadata', (t) => {
  const w = new Workflow(simpleWorkflow);

  t.deepEqual(w.openfn, simpleWorkflow.openfn);
});

test('a Workflow class can serialize to JSON', (t) => {
  const w = new Workflow(simpleWorkflow);
  const json = w.toJSON();

  t.deepEqual(json, simpleWorkflow);
});

test('get - get a step', (t) => {
  const w = new Workflow(simpleWorkflow);

  const step = w.get('a');

  t.deepEqual(step, simpleWorkflow.steps[0]);
});

test('get - get an edge', (t) => {
  const w = new Workflow(simpleWorkflow);

  const edge = w.get('a-c');

  t.deepEqual(edge, simpleWorkflow.steps[0].next.c);
});

test('get - throw if not found', (t) => {
  const w = new Workflow(simpleWorkflow);

  t.throws(() => w.get('x'), {
    message: 'step/edge with id "x" does not exist in workflow',
  });
});

test('getEdge - get an edge', (t) => {
  const w = new Workflow(simpleWorkflow);

  const edge = w.getEdge('a', 'c');

  t.deepEqual(edge, simpleWorkflow.steps[0].next.c);
});

test('set properties on a step', (t) => {
  const w = new Workflow(simpleWorkflow);

  w.set('a', { adaptor: 'salesforce' });

  const step = w.get('a');
  t.is(step.adaptor, 'salesforce');
});

test('set properties on a step, with a chain', (t) => {
  const w = new Workflow(simpleWorkflow);

  w.set('a', { adaptor: 'salesforce' }).set('b', { adaptor: 'dhis2' });

  const a = w.get('a');
  t.is(a.adaptor, 'salesforce');

  const b = w.get('b');
  t.is(b.adaptor, 'dhis2');
});

test('set properties on an edge', (t) => {
  const w = new Workflow(simpleWorkflow);

  w.set('a-c', { condition: '!state.error' });

  const edge = w.get('a-c');
  t.is(edge.condition, '!state.error');
});

test("Editing a workflow internally doesn't affect the input", (t) => {
  const w = new Workflow(simpleWorkflow);

  w.set('a', { adaptor: 'salesforce' });

  t.falsy(simpleWorkflow.steps[0].adaptor);
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

  t.deepEqual(w.index.uuid['a'], simpleWorkflow.steps[0].openfn.uuid);
  t.deepEqual(w.index.uuid['b'], simpleWorkflow.steps[1].openfn.uuid);
  t.deepEqual(w.index.uuid['c'], simpleWorkflow.steps[2].openfn.uuid);
  t.deepEqual(w.index.uuid['a-c'], simpleWorkflow.steps[0].next.c.openfn.uuid);
  t.deepEqual(w.index.uuid['b-c'], simpleWorkflow.steps[1].next.c.openfn.uuid);
});

test('map uuids to ids', (t) => {
  const w = new Workflow(simpleWorkflow);
  const uuid_a = simpleWorkflow.steps[0].openfn.uuid;
  const uuid_b = simpleWorkflow.steps[1].openfn.uuid;
  const uuid_c = simpleWorkflow.steps[2].openfn.uuid;
  const uuid_ac = simpleWorkflow.steps[0].next.c.openfn.uuid;
  const uuid_bc = simpleWorkflow.steps[1].next.c.openfn.uuid;

  t.deepEqual(w.index.id[uuid_a], 'a');
  t.deepEqual(w.index.id[uuid_b], 'b');
  t.deepEqual(w.index.id[uuid_c], 'c');
  t.deepEqual(w.index.id[uuid_ac], 'a-c');
  t.deepEqual(w.index.id[uuid_bc], 'b-c');
});
