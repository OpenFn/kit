import test from 'ava';
import mock from 'mock-fs';
import { parseProject } from '../../src/parse/from-fs';

const s = JSON.stringify;

// mock several projects and use them through the tests
mock({
  '/p1': {},
  '/p1/openfn.json': s({
    env: 'staging', // the name of the checked out project
    workflowRoot: 'workflows',
    formats: {
      openfn: 'yaml', // TODO actually isn't this implied?
      project: 'yaml',
      workflow: 'yaml',
    },
    // Do I want this here?
    // Or do we go and look in the project file?
    // Let's look in the project file eh
    // project: {
    //  name: 'My Project', // This should be here because I can see and edit the project name locally
    //  description: '...'

    //  endpoint: 'www; // this should not be here because I don't change this as a human
    // },
  }),
  // TODO do I really need these intemittend folders?
  '/p1/workflows': {},
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

test('should load the openfn config from json', async (t) => {
  const project = await parseProject('/p1');
  t.log(project);

  t.is(project.config.env, 'staging');

  // t.is(project.name, 'aaa');
  // t.is(project.description, 'a project');
});

test.todo('should load the openfn config from yaml');

test.only('should load a workflow from the file system', async (t) => {
  const project = await parseProject('/p1');
  t.log(project.workflows);

  t.is(project.workflows.length, 1);
  const [wf] = project.workflows;

  t.is(wf.id, 'wf1');
  t.is(wf.steps[0].expression, 'fn(s => s)');
});
