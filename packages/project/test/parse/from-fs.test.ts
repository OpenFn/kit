import test from 'ava';
import mock from 'mock-fs';
import { parseProject } from '../../src/parse/from-fs';

const s = JSON.stringify;

// mock several projects and use them through the tests
mock({
  '/p1': {},
  '/p1/openfn.json': s({
    // this must be the whole deploy name right?
    // else how do we know?
    workflowRoot: 'workflows',
    formats: {
      openfn: 'yaml', // TODO actually isn't this implied?
      project: 'yaml',
      workflow: 'yaml',
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
  // // hmm I don't think we need to model this
  // // in the PROJECT. It should all be implicit.
  // '/p1/projects/staging@app.openfn.org.json': s({
  //   openfn: {
  //     projectId: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
  //     endpoint: 'http://localhost:4000',
  //   },
  // }),
  '/p1/workflows/my-workflow': {},
  '/p1/workflows/my-workflow/my-workflow.json': s({
    id: 'wf1',
    name: 'wf1',
    steps: [
      {
        id: 'job',
        expression: 'job.js', // TODO test different formats, ie ./job.js
      },
    ], // TODO handle expressions too!
    // TODO maybe test the options key though
  }),
  '/p1/workflows/my-workflow/job.js': `fn(s => s)`,

  // junk to throw the tests
  '/p1/random.json': s({
    // not a workflow file! this should be ignored
  }),
  '/p1/workflows/my-workflow/random.json': s({
    // not a workflow file! this should be ignored
  }),
});

test('should load the openfn repo config from json', async (t) => {
  const project = await parseProject('/p1');

  t.deepEqual(project.repo, {
    workflowRoot: 'workflows',
    formats: { openfn: 'yaml', project: 'yaml', workflow: 'yaml' },
  });
});

test('should load the openfn project config from json', async (t) => {
  const project = await parseProject('/p1');

  t.deepEqual(project.openfn, {
    id: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
    env: 'staging',
    endpoint: 'https://app.openfn.org',
    name: 'My Project',
    description: '...',
  });
});

test.todo('should load the openfn config from yaml');

test('should load a workflow from the file system', async (t) => {
  const project = await parseProject('/p1');
  // t.log(project.workflows);

  t.is(project.workflows.length, 1);
  const [wf] = project.workflows;

  t.is(wf.id, 'wf1');
  t.is(wf.steps[0].expression, 'fn(s => s)');
});
