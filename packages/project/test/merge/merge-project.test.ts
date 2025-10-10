import test from 'ava';
import { randomUUID } from 'node:crypto';
import Project from '../../src';
import { merge } from '../../src/merge/merge-project';
import { join } from 'node:path';
import { generateWorkflow } from '../../src/gen/generator';
import slugify from '../../src/util/slugify';

// go over each node in a workflow and add a new uuid
// does not mutate
const assignUUIDs = (workflow) => ({
  ...workflow,
  steps: workflow.steps.map((s) => {
    const step = {
      ...s,
      openfn: {
        uuid: randomUUID(),
      },
    };
    if (s.next) {
      // TODO this reduction isn't quite right
      step.next = Object.keys(s.next).reduce((obj, key) => {
        obj[key] = {
          condition: true,
          openfn: {
            uuid: randomUUID(),
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

test('merge a simple change between single-step workflows with preserved uuids', (t) => {
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
  const wf_a = assignUUIDs(wf);
  const wf_b = assignUUIDs(wf);
  // console.log(JSON.stringify(wf_a, null, 2));

  const main = createProject(wf_a, 'a');
  const staging = createProject(wf_b, 'b');

  // merge staging into main
  const result = merge(staging, main);
  // console.log(JSON.stringify(result.workflow, null, 2));

  t.is(result.name, 'a');
  t.is(result.openfn.uuid, main.openfn.uuid);

  const step = result.workflows[0].steps[0];
  // The step should be totally unchanged
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
  const source = generateWorkflow(`@name wf a-b`).set('a-b', {
    condition: true,
  });
  const target = generateWorkflow(`@name wf a-b`);

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

test('id match: same workflow in source and target project', (t) => {
  const source = generateWorkflow('@name some_workflow a-b');
  const target = generateWorkflow('@name some_workflow a-b');

  const source_project = createProject(source);
  const target_project = createProject(target);
  t.is(source_project.workflows[0].id, target_project.workflows[0].id);
  const result = merge(source_project, target_project);

  t.is(result.workflows.length, 1);
  t.is(result.workflows[0].name, 'some_workflow');
  t.is(result.workflows[0].id, 'some_workflow');
});

test('no id match: union of both workflow', (t) => {
  const source = generateWorkflow('@name some_workflow a-b');
  const target = generateWorkflow('@name another_workflow a-b');

  const source_project = createProject(source);
  const target_project = createProject(target);
  const result = merge(source_project, target_project);

  t.is(result.workflows.length, 2);
  t.deepEqual(
    result.workflows.map((w) => w.name).sort(),
    ['another_workflow', 'some_workflow'].sort()
  );
});

test('no id match: workflow-mapping', (t) => {
  const source = generateWorkflow('@name some_workflow a-b');
  const target = generateWorkflow('@name another_workflow a-b');

  const source_project = createProject(source);
  const target_project = createProject(target);
  const result = merge(source_project, target_project, {
    workflowMappings: {
      some_workflow: 'another_workflow',
    },
  });

  t.is(result.workflows.length, 1);
  t.deepEqual(result.workflows[0].name, 'some_workflow');
});

test('no id match: workflow-mapping with non-existent workflow', (t) => {
  const source = generateWorkflow('@id some_workflow a-b');
  const target = generateWorkflow('@id another_workflow a-b');

  const source_project = createProject(source);
  const target_project = createProject(target);
  const result = merge(source_project, target_project, {
    workflowMappings: {
      some_workflow: 'non-existing-workflow',
    },
  });

  t.is(result.workflows.length, 2);
  t.deepEqual(
    result.workflows.map((w) => w.name).sort(),
    ['another_workflow', 'some_workflow'].sort()
  );
});

test('id match: preserve target uuid', (t) => {
  const source = generateWorkflow('@name some_workflow a-b', {
    openfnUuid: true,
  });
  const target = generateWorkflow('@name another_workflow a-b', {
    openfnUuid: true,
  });

  const source_project = createProject(source);
  const target_project = createProject(target);
  const result = merge(source_project, target_project, {
    workflowMappings: {
      some_workflow: 'another_workflow',
    },
  });

  t.is(result.workflows.length, 1);
  t.is(result.workflows[0].name, 'some_workflow');
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
    result.workflows.map((w) => w.name),
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
    generateWorkflow('@name a a-new'),
    generateWorkflow('@name b b-new'),
    generateWorkflow('@name c'),
  ]);
  const target_project = createProject([
    generateWorkflow('@name a a-old'),
    generateWorkflow('@name b b-old'),
    generateWorkflow('@name d d-old'),
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
    result.workflows.map((w) => w.name),
    ['a', 'b', 'd']
  );
});

test('options: mapping & removeUnmapped=true', (t) => {
  const source_project = createProject([
    generateWorkflow('@name a a-new'),
    generateWorkflow('@name b b-new'),
    generateWorkflow('@name c c-x'),
  ]);
  const target_project = createProject([
    generateWorkflow('@name a a-old'),
    generateWorkflow('@name b b-old'),
    generateWorkflow('@name d d-old'),
  ]);
  const result = merge(source_project, target_project, {
    workflowMappings: { a: 'a' },
    removeUnmapped: true,
  });

  // should be the new version of a
  t.truthy(result.getWorkflow('a')?.get('new'));

  t.deepEqual(
    result.workflows.map((w) => w.name),
    ['a']
  );
});

test('options: mapping(rename) & removeUnmapped=false', (t) => {
  const source_project = createProject([
    generateWorkflow('@name a a-new'),
    generateWorkflow('@name b b-new'),
    generateWorkflow('@name c c-new'),
  ]);
  const target_project = createProject([
    generateWorkflow('@name a a-old'),
    generateWorkflow('@name b b-old'),
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
    result.workflows.map((w) => w.name),
    ['c', 'b']
  );
});

test('options: multiple source into one target error', (t) => {
  const source_project = createProject([
    generateWorkflow('@name a a-new'),
    generateWorkflow('@name b b-new'),
    generateWorkflow('@name c c-new'),
  ]);
  const target_project = createProject([
    generateWorkflow('@name a a-old'),
    generateWorkflow('@name b b-old'),
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
