import test from 'ava';
import { randomUUID } from 'node:crypto';
import Project from '../../src';
import {
  merge,
  REPLACE_MERGE,
  replaceCredentials,
} from '../../src/merge/merge-project';
import { generateWorkflow } from '../../src/gen/generator';
import { Credential } from '../../src/Project';

let idgen = 0;

// go over each node in a workflow and add a new uuid
// does not mutate
const assignUUIDs = (workflow, generator = randomUUID) => ({
  id: 'wf',
  ...workflow,
  steps: workflow.steps.map((s) => {
    const step = {
      ...s,
      openfn: {
        uuid: generator(),
      },
    };
    if (s.next) {
      // TODO this reduction isn't quite right
      step.next = Object.keys(s.next).reduce((obj, key) => {
        obj[key] = {
          condition: true,
          openfn: {
            uuid: generator(),
          },
        };
        return obj;
      }, {});
    }
    return step;
  }),
});

const createProject = (workflow, id = 'a') =>
  new Project({
    id,
    name: id,
    workflows: Array.isArray(workflow) ? workflow : [workflow],
    openfn: {
      uuid: randomUUID(),
    },
  });

const createStep = (id, props) => ({
  id,
  adaptor: 'common',
  expression: 'fn(s => s)',
  openfn: {
    uuid: randomUUID(),
  },
});

test('Preserve the name and UUID of the target project', (t) => {
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
  t.is(result.openfn.uuid, main.openfn.uuid);
});

test('replace mode: replace the name and UUID of the target project', (t) => {
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

  const remote = createProject(wf_a, 'a');
  const local = createProject(wf_b, 'b');

  // merge staging into main
  const result = merge(local, remote, { mode: REPLACE_MERGE });
  const step = result.workflows[0].steps[0];

  // Ensure that the result has the name and UUID of local
  t.is(result.name, 'b');
  t.is(result.openfn.uuid, local.openfn.uuid);
});

test('merge a simple change between single-step workflows with preserved uuids', (t) => {
  // create a base workflow
  const wf = {
    id: 'wf',
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
  t.is(result.openfn.uuid, main.openfn.uuid);

  t.is(step.adaptor, wf_b.steps[0].adaptor);
  t.is(step.openfn.uuid, wf_a.steps[0].openfn.uuid);
});

test('merge with history (prefers source history)', (t) => {
  // create a base workflow
  const wf = {
    id: 'wf',
    history: ['a'],
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
  wf_b.history.push('b');

  // change the adaptor
  wf_b.steps[0].adaptor = 'http';

  const main = createProject(wf_a, 'a');
  const staging = createProject(wf_b, 'b');

  // merge staging into main
  const result = merge(staging, main);

  t.deepEqual(result.workflows[0].history, ['a', 'b']);
});

test('merge a simple change between single-step workflows with preserved numeric uuids', (t) => {
  // create a base workflow
  const wf = {
    id: 'wf',
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
  const wf_a = assignUUIDs(wf, () => ++idgen);
  const wf_b = assignUUIDs(wf, () => ++idgen);

  // change the adaptor
  wf_b.steps[0].adaptor = 'http';

  const main = createProject(wf_a, 'a');
  const staging = createProject(wf_b, 'b');

  // merge staging into main
  const result = merge(staging, main);
  const step = result.workflows[0].steps[0];

  // The resulting project should basically be main but with a different adaptor

  t.is(result.name, 'a');
  t.is(result.openfn.uuid, main.openfn.uuid);

  t.is(step.adaptor, wf_b.steps[0].adaptor);
  t.is(step.openfn.uuid, wf_a.steps[0].openfn.uuid);
});

test('merge a new step into an existing workflow', (t) => {
  // create a base workflow
  const wf = {
    name: 'wf',
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
  const [x, y] = result.workflows[0].steps;
  t.is(result.name, 'a');
  t.is(result.openfn.uuid, main.openfn.uuid);

  t.deepEqual(x, wf_a.steps[0]);
  t.deepEqual(y, wf_b.steps[1]);
});

test('merge with an edge and no changes', (t) => {
  // create a base workflow
  const wf = {
    name: 'wf',
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
  const wf_a = assignUUIDs(wf, () => ++idgen);
  const wf_b = assignUUIDs(wf, () => ++idgen);
  // console.log(JSON.stringify(wf_a, null, 2));

  const main = createProject(wf_a, 'a');
  const staging = createProject(wf_b, 'b');

  // merge staging into main
  const result = merge(staging, main);
  // console.log(JSON.stringify(result.workflow, null, 2));

  t.is(result.name, 'a');
  t.is(result.openfn.uuid, main.openfn.uuid);

  const step = result.workflows[0].steps[0];
  // The step and edge should be totally unchanged
  t.deepEqual(step.next, wf_a.steps[0].next);
});

test('merge with a change to an edge condition', (t) => {
  // create a base workflow
  const wf = {
    name: 'wf',
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

  const main = createProject(wf_a, 'a');
  const staging = createProject(wf_b, 'b');

  // merge staging into main
  const result = merge(staging, main);
  // console.log(JSON.stringify(result.workflow, null, 2));

  t.is(result.name, 'a');
  t.is(result.openfn.uuid, main.openfn.uuid);

  const step = result.workflows[0].steps[0];
  t.deepEqual(step.next.y.openfn, wf_a.steps[0].next.y.openfn);
  t.is(step.next.y.condition, 'z');
});

test('remove a step from an existing workflow', (t) => {
  // create a base workflow
  const wf = {
    name: 'wf',
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

test('merge an id change in a single step with preserved uuids', (t) => {
  // create a base workflow
  const wf = {
    name: 'wf',
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
  // NOTE: wouldn't work, id has changed, hence they didn't map. it's a new node!
  // t.is(step.openfn.uuid, wf_a.steps[0].openfn.uuid);
});

test('should merge two projects and preserve edge id', (t) => {
  const source = generateWorkflow(`a-b`).set('a-b', {
    condition: true,
  });
  const target = generateWorkflow(`a-b`);

  t.not(source.getUUID('a-b'), target.getUUID('a-b'));
  const result = merge(
    createProject(source.workflow),
    createProject(target.workflow)
  );

  const resultEdge = result.workflows[0].steps[0].next['b'];
  // preserve edge condition from source
  t.is(resultEdge.condition, true);
  // preserve edge id from target
  t.is(target.getUUID('a-b'), resultEdge.openfn.uuid);
});

test('merge a new workflow', (t) => {
  const wf1 = assignUUIDs({
    name: 'wf1',
    steps: [],
  });
  // Wf2 has no UUIDs
  const wf2 = {
    name: 'wf2',
    steps: [],
  };

  const main = createProject([wf1], 'a');
  const staging = createProject([wf1, wf2], 'b');
  t.is(main.workflows.length, 1)
  t.is(staging.workflows.length, 2)

  const result = merge(staging, main);
  t.is(result.workflows.length, 2)
});

test('merge a new workflow with onlyUpdated: true', (t) => {
  const wf1 = assignUUIDs({
    name: 'wf1',
    steps: [],
  });
  // Wf2 has no UUIDs
  const wf2 = {
    name: 'wf2',
    steps: [],
  };

  const main = createProject([wf1], 'a');
  const staging = createProject([wf1, wf2], 'b');
  t.is(main.workflows.length, 1)
  t.is(staging.workflows.length, 2)

  const result = merge(staging, main, { onlyUpdated: true });
  t.is(result.workflows.length, 2)
});

test('remove a workflow', (t) => {
  const wf1 = assignUUIDs({
    name: 'wf1',
    steps: [],
  });
  const wf2 = assignUUIDs({
    name: 'wf2',
    steps: [],
  });

  const main = createProject([wf1, wf2], 'a');
  const staging = createProject([wf1], 'b');
  
  t.is(main.workflows.length, 2)
  t.is(staging.workflows.length, 1)

  const result = merge(staging, main);
  t.is(result.workflows.length, 1)
});

test('remove a workflow with onlyUpdated: true', (t) => {
  const wf1 = assignUUIDs({
    name: 'wf1',
    steps: [],
  });
  const wf2 = assignUUIDs({
    name: 'wf2',
    steps: [],
  });

  const main = createProject([wf1, wf2], 'a');
  const staging = createProject([wf1], 'b');
  
  t.is(main.workflows.length, 2)
  t.is(staging.workflows.length, 1)

  const result = merge(staging, main, { onlyUpdated: true });
  t.is(result.workflows.length, 1)
});

test('id match: same workflow in source and target project', (t) => {
  const source = generateWorkflow('a-b');
  const target = generateWorkflow('a-b');

  const source_project = createProject(source);
  const target_project = createProject(target);
  t.is(source_project.workflows[0].id, target_project.workflows[0].id);
  const result = merge(source_project, target_project);

  t.is(result.workflows.length, 1);
  t.is(result.workflows[0].id, 'workflow');
});

test('no id match: union of both workflow', (t) => {
  const source = generateWorkflow('@id workflow a-b');
  const target = generateWorkflow('@id another_workflow a-b');

  const source_project = createProject(source);
  const target_project = createProject(target);
  const result = merge(source_project, target_project);

  t.is(result.workflows.length, 2);
  t.deepEqual(
    result.workflows.map((w) => w.id).sort(),
    ['another_workflow', 'workflow'].sort()
  );
});

test('no id match: workflow-mapping', (t) => {
  const source = generateWorkflow('@id x a-b');
  const target = generateWorkflow('@id y a-b');

  const source_project = createProject(source);
  const target_project = createProject(target);
  const result = merge(source_project, target_project, {
    workflowMappings: {
      x: 'y',
    },
  });

  t.is(result.workflows.length, 1);
});

test('no id match: workflow-mapping with non-existent workflow', (t) => {
  const source = generateWorkflow('@id workflow a-b');
  const target = generateWorkflow('@id another_workflow a-b');

  const source_project = createProject(source);
  const target_project = createProject(target);
  const result = merge(source_project, target_project, {
    workflowMappings: {
      workflow: 'non-existing-workflow',
    },
  });

  t.is(result.workflows.length, 2);
  t.deepEqual(
    result.workflows.map((w) => w.id).sort(),
    ['another_workflow', 'workflow'].sort()
  );
});

test('id match: preserve target uuid', (t) => {
  const source = generateWorkflow('@id some_workflow a-b', {
    openfnUuid: true,
  });
  const target = generateWorkflow('@id another_workflow a-b', {
    openfnUuid: true,
  });

  const source_project = createProject(source);
  const target_project = createProject(target);
  const result = merge(source_project, target_project, {
    workflowMappings: {
      workflow: 'another_workflow',
    },
  });

  t.is(result.workflows.length, 1);
  // we expect every thing in target to be overridden except the uuid
  t.is(result.workflows[0].openfn.uuid, target.openfn.uuid);
});
// should preserve UUID if id changes

// should generate a UUID if name, adaptor and expression fail

// should generate a UUID if change is ambiguous

test('options: no mappings & removeUnmapped=false', (t) => {
  const source_project = createProject([
    generateWorkflow('@id a a-new'),
    generateWorkflow('@id b b-new'),
    generateWorkflow('@id c c-new'),
  ]);
  const target_project = createProject([
    generateWorkflow('@id a a-old'),
    generateWorkflow('@id b b-old'),
    generateWorkflow('@id d d-old'),
  ]);
  const result = merge(source_project, target_project);
  // should be the new version of a,b,c
  t.truthy(result.getWorkflow('a')?.get('new'));
  t.truthy(result.getWorkflow('b')?.get('new'));
  t.truthy(result.getWorkflow('c')?.get('new'));
  // then old version of d
  t.truthy(result.getWorkflow('d')?.get('old'));

  t.deepEqual(
    result.workflows.map((w) => w.id),
    ['a', 'b', 'c', 'd']
  );
});

test('options: no mappings & removeUnmapped=true', (t) => {
  const source_project = createProject([
    generateWorkflow('@id a a-new'),
    generateWorkflow('@id b b-new'),
    generateWorkflow('@id c c-new'),
  ]);
  const target_project = createProject([
    generateWorkflow('@id a a-old'),
    generateWorkflow('@id b b-old'),
    generateWorkflow('@id d d-old'),
    generateWorkflow('@id e e-old'),
  ]);
  const result = merge(source_project, target_project, {
    removeUnmapped: true,
  });

  // should be the new version of a,b,c
  t.truthy(result.getWorkflow('a')?.get('new'));
  t.truthy(result.getWorkflow('b')?.get('new'));
  t.truthy(result.getWorkflow('c')?.get('new'));

  t.deepEqual(
    result.workflows.map((w) => w.id),
    ['a', 'b', 'c']
  );
});

test('options: mapping & removeUnmapped=false', (t) => {
  const source_project = createProject([
    generateWorkflow('@id a a-new'),
    generateWorkflow('@id b b-new'),
    generateWorkflow('@id d d-new'),
  ]);
  const target_project = createProject([
    generateWorkflow('@id a a-old'),
    generateWorkflow('@id b b-old'),
    generateWorkflow('@id d d-old'),
  ]);
  const result = merge(source_project, target_project, {
    workflowMappings: { a: 'a' },
    removeUnmapped: false,
  });

  // should be the new version of a
  t.truthy(result.getWorkflow('a')?.get('new'));
  // should be the old version of b & d
  t.truthy(result.getWorkflow('b')?.get('old'));
  t.truthy(result.getWorkflow('d')?.get('old'));

  t.deepEqual(
    result.workflows.map((w) => w.id),
    ['a', 'b', 'd']
  );
});

test('options: mapping & removeUnmapped=true', (t) => {
  const source_project = createProject([
    generateWorkflow('@id a a-new'),
    generateWorkflow('@id b b-new'),
    generateWorkflow('@id c c-x'),
  ]);
  const target_project = createProject([
    generateWorkflow('@id a a-old'),
    generateWorkflow('@id b b-old'),
    generateWorkflow('@id d d-old'),
  ]);
  const result = merge(source_project, target_project, {
    workflowMappings: { a: 'a' },
    removeUnmapped: true,
  });

  // should be the new version of a
  t.truthy(result.getWorkflow('a')?.get('new'));

  t.deepEqual(
    result.workflows.map((w) => w.id),
    ['a']
  );
});

test('options: mapping(rename) & removeUnmapped=false', (t) => {
  const source_project = createProject([
    generateWorkflow('@id a a-new'),
    generateWorkflow('@id b b-new'),
    generateWorkflow('@id c c-new'),
  ]);
  const target_project = createProject([
    generateWorkflow('@id a a-old'),
    generateWorkflow('@id b b-old'),
  ]);
  const result = merge(source_project, target_project, {
    workflowMappings: { c: 'a' },
    removeUnmapped: false,
  });

  // should be the new version of c
  t.truthy(result.getWorkflow('c')?.get('new'));
  // old version of b
  t.truthy(result.getWorkflow('b')?.get('old'));

  t.deepEqual(
    result.workflows.map((w) => w.id),
    ['c', 'b']
  );
});

test('options: multiple source into one target error', (t) => {
  const source_project = createProject([
    generateWorkflow('a-new'),
    generateWorkflow('b-new'),
    generateWorkflow('c-new'),
  ]);
  const target_project = createProject([
    generateWorkflow('a-old'),
    generateWorkflow('b-old'),
  ]);

  t.throws(
    () =>
      merge(source_project, target_project, {
        workflowMappings: { a: 'a', c: 'a' },
        removeUnmapped: false,
      }),
    {
      instanceOf: Error,
      message: /multiple source workflows/,
    }
  );
});

test('options: onlyUpdated with no changed workflows', (t) => {
  // If I do this as a replace, and nothing has changed, the target UUIDs should be preserved
  const source = createProject([
    generateWorkflow('@id a a-b', { history: true }),
    generateWorkflow('@id b x-y', { history: true }),
  ]);
  const target = createProject([
    generateWorkflow('@id a a-b', { history: true }),
    generateWorkflow('@id b x-y', { history: true }),
  ]);

  const result = merge(source, target, {
    onlyUpdated: true,
    mode: 'replace',
  });

  // step UUIDs in the target should not have changed
  t.is(
    result.workflows[0].steps[0].openfn.uuid,
    target.workflows[0].steps[0].openfn.uuid
  );
  t.is(
    result.workflows[0].steps[1].openfn.uuid,
    target.workflows[0].steps[1].openfn.uuid
  );
});

test('options: onlyUpdated with 1 changed, 1 unchanged workflow', (t) => {
  // If I do this as a replace, and nothing has changed, the target UUIDs should be preserved
  const source = createProject([
    generateWorkflow('@id a a-b', { uuidSeed: 100, history: true }),
    generateWorkflow('@id b x-y', { uuidSeed: 200, history: true }),
  ]);
  const target = createProject([
    generateWorkflow('@id a a-b', { uuidSeed: 100, history: true }),
    generateWorkflow('@id b x-y', { uuidSeed: 200, history: true }),
  ]);

  // Scribble on both workflows
  target.workflows[0].jam = 'jar';
  target.workflows[1].jam = 'jar';

  // change the source
  source.workflows[0].steps[0].expression = 'fn()';

  const result = merge(source, target, {
    onlyUpdated: true,

    // Set this to mode replace and use UUIDs as a proxy for
    // "did this thing change?"
    mode: 'replace',
  });

  // step 1 has changed and should match the source
  t.is(result.workflows[0].steps[0].expression, 'fn()');
  // And our scribble should be lost
  t.falsy(result.workflows[0].jam);

  // but step 2 did not change and should have our scribble
  t.is(result.workflows[1].jam, 'jar');
});

test.todo('options: only changed and 1 workflow');

// this test it's important that the final project includes the unchanged workflow
test.todo('options: only changed, and 1 changed, 1 unchanged workflow');

test('replaceCredentials: preserves target credentials with their UUIDs', (t) => {
  const targetCreds: Credential[] = [
    { uuid: 'target-uuid-1', name: 'cred1', owner: 'user1' },
    { uuid: 'target-uuid-2', name: 'cred2', owner: 'user1' },
  ];

  const result = replaceCredentials([], targetCreds);

  t.is(result.length, 2);
  t.is(result[0].uuid, 'target-uuid-1');
  t.is(result[1].uuid, 'target-uuid-2');
});

test('replaceCredentials: adds new credentials from source without their UUIDs', (t) => {
  const sourceCreds: Credential[] = [
    { uuid: 'source-uuid-1', name: 'newcred', owner: 'user1' },
  ];
  const targetCreds: Credential[] = [
    { uuid: 'target-uuid-1', name: 'existingcred', owner: 'user1' },
  ];

  const result = replaceCredentials(sourceCreds, targetCreds);

  t.is(result.length, 2);
  // First credential should be the existing target credential
  t.is(result[0].uuid, 'target-uuid-1');
  t.is(result[0].name, 'existingcred');

  // Second credential should be the new one from source, but without UUID
  t.is(result[1].name, 'newcred');
  t.is(result[1].owner, 'user1');
  t.falsy(result[1].uuid);
});

test('replaceCredentials: does not duplicate credentials with same name/owner', (t) => {
  const sourceCreds: Credential[] = [
    { uuid: 'source-uuid-1', name: 'samecred', owner: 'user1' },
  ];
  const targetCreds: Credential[] = [
    { uuid: 'target-uuid-1', name: 'samecred', owner: 'user1' },
  ];

  const result = replaceCredentials(sourceCreds, targetCreds);

  // Should only have one credential (from target)
  t.is(result.length, 1);
  t.is(result[0].uuid, 'target-uuid-1');
  t.is(result[0].name, 'samecred');
  t.is(result[0].owner, 'user1');
});

test('replaceCredentials: treats credentials with different owners as different', (t) => {
  const sourceCreds: Credential[] = [
    { uuid: 'source-uuid-1', name: 'cred1', owner: 'user2' },
  ];
  const targetCreds: Credential[] = [
    { uuid: 'target-uuid-1', name: 'cred1', owner: 'user1' },
  ];

  const result = replaceCredentials(sourceCreds, targetCreds);

  // Should have both credentials (different owners)
  t.is(result.length, 2);
  t.is(result[0].owner, 'user1');
  t.is(result[1].owner, 'user2');
  t.falsy(result[1].uuid);
});

test('replaceCredentials: handles multiple new and existing credentials', (t) => {
  const sourceCreds: Credential[] = [
    { uuid: 'source-uuid-1', name: 'existing', owner: 'user1' },
    { uuid: 'source-uuid-2', name: 'new1', owner: 'user1' },
    { uuid: 'source-uuid-3', name: 'new2', owner: 'user2' },
  ];
  const targetCreds: Credential[] = [
    { uuid: 'target-uuid-1', name: 'existing', owner: 'user1' },
    { uuid: 'target-uuid-2', name: 'old', owner: 'user1' },
  ];

  const result = replaceCredentials(sourceCreds, targetCreds);

  t.is(result.length, 4);

  // First two should be from target with their UUIDs
  t.is(result[0].uuid, 'target-uuid-1');
  t.is(result[1].uuid, 'target-uuid-2');

  // Next two should be new credentials without UUIDs
  t.is(result[2].name, 'new1');
  t.falsy(result[2].uuid);
  t.is(result[3].name, 'new2');
  t.falsy(result[3].uuid);
});
