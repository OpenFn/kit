import mock from 'mock-fs';
import { jsonToYaml, Workspace } from '../src';
import test from 'ava';

// TODO need a test on the legacy and new yaml formats here
mock({
  '/ws/openfn.yaml': jsonToYaml({
    project: {
      id: 'project-1',
      uuid: '1234',
    },
    workspace: {
      formats: {
        openfn: 'yaml',
        project: 'yaml',
        workflow: 'yaml',
        custom: true, // Note that this will be excluded
      },
      // deliberately exclude dirs
      custom: true,
    },
  }),
  '/ws/.projects/staging@app.openfn.org.yaml': jsonToYaml({
    name: 'Project 1',
    id: '<uuid-1>',
    workflows: [
      {
        name: 'simple-workflow', // TODO clean up
        id: 'wf-id', // TODO clean up
        jobs: [
          {
            name: 'Transform data to FHIR standard',
            body: ' fn(state => state); // sdfl',
            adaptor: '@openfn/language-http@latest',
            id: 'job-a',
          },
        ],
        triggers: [
          {
            type: 'webhook',
            enabled: true,
            id: 'trigger-id',
          },
        ],
        edges: [
          {
            id: 'edge-id',
            target_job_id: 'job-a',
            enabled: true,
            source_trigger_id: 'trigger-id',
            condition_type: 'always',
          },
        ],
      },
      {
        name: 'another-workflow',
        id: 'another-id',
        jobs: [
          {
            name: 'Transform data to FHIR standard',
            body: ' fn(state => state); // sdfl',
            adaptor: '@openfn/language-http@latest',
            id: 'job-b',
          },
        ],
        triggers: [
          {
            type: 'webhook',
            enabled: true,
            id: 'trigger-id',
          },
        ],
        edges: [
          {
            id: 'edge-id',
            target_job_id: 'job-b',
            enabled: true,
            source_trigger_id: 'trigger-id',
            condition_type: 'always',
          },
        ],
      },
    ],
  }),

  // json format
  '/ws2/openfn.yaml': jsonToYaml({
    project: {
      id: 'project-2',
      uuid: '<uuid-id2>',
    },
    workspace: {
      formats: {
        openfn: 'yaml',
        project: 'json',
        workflow: 'yaml',
      },
    },
  }),
  '/ws2/.projects/staging@app.openfn.org.json': JSON.stringify({
    name: 'Project 2',
    id: '<uuid-2>',
    workflows: [
      {
        name: 'Simple Workflow',
        id: '<uuid>',
        jobs: [
          {
            name: 'X',
            body: '.',
            adaptor: '@openfn/language-http@latest',
            id: 'a',
          },
        ],
        triggers: [
          {
            type: 'webhook',
            enabled: true,
            id: 'trigger-id',
          },
        ],
        edges: [
          {
            id: 'edge-id',
            target_job_id: 'a',
            enabled: true,
            source_trigger_id: 'trigger-id',
            condition_type: 'always',
          },
        ],
      },
    ],
  }),

  // custom paths
  '/ws3/openfn.yaml': jsonToYaml({
    project: {
      id: 'project-3',
      uuid: '<uuid-3>',
    },
    workspace: {
      dirs: {
        projects: 'p',
      },
    },
  }),
  '/ws3/p/project@app.openfn.org.yaml': jsonToYaml({
    name: 'Project 3',
    id: '<uuid-3>',
    workflows: [
      {
        name: 'Simple Workflow',
        id: '<uuid>',
        jobs: [
          {
            name: 'X',
            body: '.',
            adaptor: '@openfn/language-http@latest',
            id: 'a',
          },
        ],
        triggers: [
          {
            type: 'webhook',
            enabled: true,
            id: 'trigger-id',
          },
        ],
        edges: [
          {
            id: 'edge-id',
            target_job_id: 'a',
            enabled: true,
            source_trigger_id: 'trigger-id',
            condition_type: 'always',
          },
        ],
      },
    ],
  }),
});

test('workspace-path: valid workspace path', (t) => {
  const ws = new Workspace('/ws');
  t.is(ws.valid, true);
});

test.only('workspace-path: invalid workspace path', (t) => {
  const ws = new Workspace('/invalid');
  t.is(ws.valid, false);
});

test('workspace-list: list projects in the workspace', (t) => {
  const ws = new Workspace('/ws');
  t.is(ws.list().length, 1);
  t.deepEqual(
    ws.list().map((w) => w.id),
    ['project-1']
  );
});

test('workspace-get: get projects in the workspace', (t) => {
  const ws = new Workspace('/ws');
  const found = ws.get('project-1');
  t.truthy(found);
  t.is(found?.workflows.length, 2);
  t.deepEqual(
    found?.workflows.map((w) => w.id),
    ['simple-workflow', 'another-workflow']
  );
});

test('load JSON files', (t) => {
  const ws = new Workspace('/ws2');
  const proj = ws.get('project-2');
  t.truthy(proj);
  t.is(proj?.workflows.length, 1);
  t.is(proj?.workflows[0].id, 'simple-workflow');
});

test('load from custom path', (t) => {
  const ws = new Workspace('/ws3');
  const proj = ws.get('project-3');
  t.truthy(proj);
  t.is(proj?.workflows.length, 1);
  t.is(proj?.workflows[0].id, 'simple-workflow');
});

test('load config', (t) => {
  const ws = new Workspace('/ws');
  t.deepEqual(ws.config, {
    formats: {
      openfn: 'yaml',
      project: 'yaml',
      workflow: 'yaml',
    },
    dirs: {
      workflows: 'workflows',
      projects: '.projects',
    },
    custom: true,
  });
});

test('load project meta', (t) => {
  const ws = new Workspace('/ws');
  t.deepEqual(ws.activeProject, {
    uuid: '1234',
    id: 'project-1',
  });
});
