import test from 'ava';
import { randomUUID } from 'node:crypto';
import Project from '../../src';
import { merge } from '../../src/merge/merge';

// go over each node in a workflow and add a new uuid
// does not mutate
const assignUUIDs = (workflow) => ({
  ...workflow,
  steps: workflow.steps.map((s) => ({
    ...s,
    // TODO this reduction isn't quite right
    next:
      s.next &&
      Object.keys(s.next).reduce((obj, key) => {
        obj[key] = {
          condition: true,
          openfn: {
            id: randomUUID(),
          },
        };
        return obj;
      }, {}),
    openfn: {
      uuid: randomUUID(),
    },
  })),
});

const createProject = (workflow, id = 'a') =>
  new Project({
    id,
    workflows: [workflow],
    openfn: {
      uuid: randomUUID(),
    },
  });

const createStep = (id, props) => ({
  id,
  adaptor: 'common',
  expression: 'fn(s => s)',
  openfn: {
    id: randomUUID(),
  },
});

test('merge top-level project properties', (t) => {
  // create a base workflow
  const wf = {
    steps: [
      {
        id: 'x',
        name: 'X',
        adaptor: 'common',
        expression: 'fn(s => s)',
      },
    ],
  };

  // step up two copies with UUIDS
  const wf_a = assignUUIDs(wf);
  const wf_b = assignUUIDs(wf);

  const main = createProject(wf_a, 'a');
  const staging = createProject(wf_b, 'b');

  // merge staging into main
  const result = merge(staging, main);
  const step = result.workflows[0].steps[0];

  // Ensure that the result has the name and UUID of main
  t.is(result.name, 'a');
  t.is(result.openfn.uuid, main.uuid);
});

test('merge a simple change between single-step workflows with preserved uuids', (t) => {
  // create a base workflow
  const wf = {
    steps: [
      {
        id: 'x',
        name: 'X',
        adaptor: 'common',
        expression: 'fn(s => s)',
      },
    ],
  };

  // step up two copies with UUIDS
  const wf_a = assignUUIDs(wf);
  const wf_b = assignUUIDs(wf);

  // change the adaptor
  wf_b.steps[0].adaptor = 'http';

  const main = createProject(wf_a, 'a');
  const staging = createProject(wf_b, 'b');

  // merge staging into main
  const result = merge(staging, main);
  const step = result.workflows[0].steps[0];

  // The resulting project should basically be main but with a different adaptor

  t.is(result.name, 'a');
  t.is(result.openfn.uuid, main.uuid);

  t.is(step.adaptor, wf_b.steps[0].adaptor);
  t.is(step.openfn.id, wf_a.steps[0].openfn.id);
});

test('merge a new step into an existing workflow', (t) => {
  // create a base workflow
  const wf = {
    steps: [
      {
        id: 'x',
        name: 'X',
        adaptor: 'common',
        expression: 'fn(s => s)',
      },
    ],
  };

  // step up two copies with UUIDS
  const wf_a = assignUUIDs(wf);
  const wf_b = assignUUIDs(wf);

  // Add a new step
  wf_b.steps.push(createStep('y'));

  const main = createProject(wf_a, 'a');
  const staging = createProject(wf_b, 'b');

  // merge staging into main
  const result = merge(staging, main);

  // The resulting project should have:
  const [x, y] = result.workflows[0].steps[0];

  t.is(result.name, 'a');
  t.is(result.openfn.uuid, main.uuid);

  t.deepEqual(x, wf_a.steps[0]);
  t.deepEqual(y, wf_b.steps[1]);
});

test.skip('merge with an edge and no changes', (t) => {
  // create a base workflow
  const wf = {
    steps: [
      {
        id: 'x',
        name: 'X',
        adaptor: 'common',
        expression: 'fn(s => s)',
        next: {
          y: true,
        },
      },
      {
        id: 'y',
        name: 'Y',
        adaptor: 'common',
        expression: 'fn(s => s)',
      },
    ],
  };

  // step up two copies with UUIDS
  const wf_a = assignUUIDs(wf);
  const wf_b = assignUUIDs(wf);
  // console.log(JSON.stringify(wf_a, null, 2));

  const main = createProject(wf_a, 'a');
  const staging = createProject(wf_b, 'b');

  // merge staging into main
  const result = merge(staging, main);
  // console.log(JSON.stringify(result.workflow, null, 2));

  t.is(result.name, 'a');
  t.is(result.openfn.uuid, main.uuid);

  const step = result.workflows[0].steps[0];
  // The step should be totally unchanged
  t.deepEqual(step.next, wf_a.steps[0].next);
});

test('merge with a change to an edge condition', (t) => {
  // create a base workflow
  const wf = {
    steps: [
      {
        id: 'x',
        name: 'X',
        adaptor: 'common',
        expression: 'fn(s => s)',
        next: {
          y: {
            condition: true,
          },
        },
      },
      {
        id: 'y',
        name: 'Y',
        adaptor: 'common',
        expression: 'fn(s => s)',
      },
    ],
  };

  // step up two copies with UUIDS
  const wf_a = assignUUIDs(wf);
  const wf_b = assignUUIDs(wf);
  wf_b.steps[0].next.y.condition = 'z';
  console.log(JSON.stringify(wf_b, null, 2));

  const main = createProject(wf_a, 'a');
  const staging = createProject(wf_b, 'b');

  // merge staging into main
  const result = merge(staging, main);
  // console.log(JSON.stringify(result.workflow, null, 2));

  t.is(result.name, 'a');
  t.is(result.openfn.uuid, main.uuid);

  const step = result.workflows[0].steps[0];
  t.deepEqual(step.next.y.openfn, wf_a.steps[0].next.y.openfn);
  t.is(step.next.y.condition, 'z');
});

test.skip('remove a step from an existing workflow', (t) => {
  // create a base workflow
  const wf = {
    steps: [
      {
        id: 'x',
        name: 'X',
        adaptor: 'common',
        expression: 'fn(s => s)',
      },
    ],
  };

  // step up two copies with UUIDS
  const wf_a = assignUUIDs(wf);
  const wf_b = assignUUIDs(wf);

  // Remove the step
  wf_b.steps.pop();

  const main = createProject(wf_a, 'a');
  const staging = createProject(wf_b, 'b');

  // merge staging into main
  const result = merge(staging, main);

  // The resulting project should have no steps
  t.is(result.workflows[0].steps.length, 0);
});

test.skip('merge an id change in a single step with preserved uuids', (t) => {
  // create a base workflow
  const wf = {
    steps: [
      {
        id: 'x',
        name: 'X',
        adaptor: 'common',
        expression: 'fn(s => s)',
      },
    ],
  };

  // step up two copies with UUIDS
  const wf_a = assignUUIDs(wf);
  const wf_b = assignUUIDs(wf);

  // change the id
  wf_b.steps[0].id = 'z';

  const main = createProject(wf_a, 'a');
  const staging = createProject(wf_b, 'b');

  // merge staging into main
  const result = merge(staging, main);

  // The resulting project should have:
  const step = result.workflows[0].steps[0];

  // the id of staging
  t.is(step.id, 'z');
  // the uuid of main
  t.is(step.openfn.id, wf_a.steps[0].openfn.id);
});

test('should merge two simple projects and preserve uuids', () => {
  // create a
  // create b with a small difference
  // merge a in to b
});

// should preserve UUID if id changes

// should generate a UUID if name, adaptor and expression fail

// should generate a UUID if change is ambiguous
