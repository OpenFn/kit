import test from 'ava';
import mock from 'mock-fs';
import { parseProject } from '../../src/parse/from-fs';

const s = JSON.stringify;

// mock several projects and use them through the tests
// TODO: the state files here are all in v1 format - need to add tests with v2
// Probably need to rethink all these tests tbh
mock({
  '/p1/openfn.json': s({
    // this must be the whole deploy name right?
    // else how do we know?
    workflowRoot: 'workflows',
    formats: {
      openfn: 'json',
      project: 'json',
      workflow: 'json',
    },
    project: {
      id: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
      env: 'staging',
      endpoint: 'https://app.openfn.org',
      name: 'My Project',
      description: '...',
      // Note that we exclude app options here
      // That stuff is all in the project.yaml, not useful here
    },
  }),
  '/p1/workflows/my-workflow': {},
  '/p1/workflows/my-workflow/my-workflow.json': s({
    id: 'my-workflow',
    name: 'My Workflow',
    steps: [
      {
        id: 'a',
        expression: 'job.js',
        next: {
          b: true,
        },
      },
      {
        id: 'b',
        expression: './job.js',
        next: {
          c: false,
        },
      },
    ], // TODO handle expressions too!
    // TODO maybe test the options key though
  }),
  '/p1/workflows/my-workflow/job.js': `fn(s => s)`,
  // keep a state file (just the stuff we need for uuids)
  '/p1/.projects/staging@app.openfn.org.json': s({
    workflows: [
      {
        id: '<some-uuid>',
        name: 'My Workflow',
        jobs: [
          {
            id: '<uuid-1>',
            name: 'a',
            project_credential_id: 'p',
          },
          {
            id: '<uuid-2>',
            name: 'b',
          },
        ],
        triggers: [],
        edges: [
          {
            id: '<uuid-3>',
            source_job_id: '<uuid-1>',
            target_job_id: '<uuid-2>',
          },
        ],
      },
    ],
  }),

  // junk to throw the tests
  '/p1/random.json': s({
    // not a workflow file! this should be ignored
  }),
  '/p1/workflows/my-workflow/random.json': s({
    // not a workflow file! this should be ignored
  }),

  // p2 is all yaml based
  '/p2/openfn.yaml': `
    workflowRoot: wfs
    formats:
      openfn: yaml
      project: yaml
      workflow: yaml
    project:
      env: main
      id: "123"
      endpoint: app.openfn.org`,
  '/p2/wfs/my-workflow/my-workflow.yaml': `
  id: my-workflow
  name: My Workflow
  steps:
    - id: job
      adaptor: "@openfn/language-common@latest"
      expression: ./job.js
  `,
  '/p2/wfs/my-workflow/job.js': `fn(s => s)`,
  // TODO state here - quite a good test

  // p3 uses custom yaml
  '/p3/openfn.yaml': `
workspace:
  x: 1
  y: 2
project:
`,
  '/p3/wfs/my-workflow/my-workflow.yaml': `
  id: my-workflow
  name: My Workflow
  steps:
    - id: job
      adaptor: "@openfn/language-common@latest"
      expression: ./job.js
  `,
  '/p3/wfs/my-workflow/job.js': `fn(s => s)`,
});

test('should load workspace config from json', async (t) => {
  const project = await parseProject({ root: '/p1' });

  t.deepEqual(project.config, {
    workflowRoot: 'workflows',
    dirs: { projects: '.projects', workflows: 'workflows' },
    formats: { openfn: 'json', project: 'json', workflow: 'json' },
  });
});

test('should load custom config props and include default', async (t) => {
  const project = await parseProject({ root: '/p3' });

  t.deepEqual(project.config, {
    x: 1,
    y: 2,
    dirs: { projects: '.projects', workflows: 'workflows' },
    formats: { openfn: 'yaml', project: 'yaml', workflow: 'yaml' },
  });
});

test('should load the workspace config from json', async (t) => {
  const project = await parseProject({ root: '/p1' });

  t.deepEqual(project.openfn, {
    name: 'My Project',
    env: 'staging',
    endpoint: 'https://app.openfn.org',
    description: '...',
  });
});

test('should load a workflow from the file system', async (t) => {
  const project = await parseProject({ root: '/p1' });

  t.is(project.workflows.length, 1);
  const [wf] = project.workflows;

  t.is(wf.id, 'my-workflow');
  t.is(wf.openfn.uuid, '<some-uuid>');
  t.is(wf.steps[0].expression, 'fn(s => s)');
});

test('should load a workflow from the file system and expand shorthand links', async (t) => {
  const project = await parseProject({ root: '/p1' });

  t.is(project.workflows.length, 1);
  const [wf] = project.workflows;

  t.is(typeof wf.steps[1].next.c, 'object');
});

test('should track the UUID of a step', async (t) => {
  const project = await parseProject({ root: '/p1' });

  const [wf] = project.workflows;

  t.truthy(wf.steps[0].openfn);
  t.is(wf.steps[0].openfn.uuid, '<uuid-1>');
});

// TODO also test this on different openfn objects
test('should track openfn props from state file on a step', async (t) => {
  const project = await parseProject({ root: '/p1' });

  const [wf] = project.workflows;

  t.truthy(wf.steps[0].openfn);
  t.is(wf.steps[0].openfn.project_credential_id, 'p');
});

test('should track the UUID of an edge', async (t) => {
  const project = await parseProject({ root: '/p1' });

  const [wf] = project.workflows;

  t.truthy(wf.steps[0].next?.b.openfn);
  t.is(wf.steps[0].next?.b.openfn.uuid, '<uuid-3>');
});

test.todo('should track the UUID of a trigger');
// maybe track other things that aren't in workflow.yaml?

test('should load a project from yaml', async (t) => {
  const project = await parseProject({ root: '/p2' });

  t.is(project.workflows.length, 1);
  const [wf] = project.workflows;

  t.is(wf.id, 'my-workflow');
  t.is(wf.steps[0].expression, 'fn(s => s)');
});
