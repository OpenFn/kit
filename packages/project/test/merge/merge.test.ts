import test from 'ava';
import { randomUUID } from 'node:crypto';
import Project from '../../src';
import merge from '../../src/merge/merge';

// go over each node in a workflow and add a new uuid
// does not mutate
const assignUUIDs = (workflow) => ({
  ...workflow,
  steps: workflow.steps.map((s) => ({
    ...s,
    // TODO ignore edge handling for now
    // but come back soon
    // next: s.next && {
    //   ...s.next,
    //   openfn: {
    //     id: randomUUID(),
    //   },
    // },
    openfn: {
      id: randomUUID(),
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

// create a
// create b with a small difference
// merge a in to b
// assert that a, b and a-b are all unique project instances
// assert the serialized form of a
test.only('should merge two simple projects', (t) => {
  // create a base workflow
  const wf = {
    steps: [
      {
        id: 'x',
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
  const result = merge(main, staging);

  // The resulting project should have the expression of B, but the uuid of A
  const step = result.workflows[0].steps[0];
  t.is(step.adaptor, wf_b.steps[0].adaptor);
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
