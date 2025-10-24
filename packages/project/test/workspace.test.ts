import mock from 'mock-fs';
import { jsonToYaml, Workspace } from '../src';
import test from 'ava';

// TODO need a test on the legacy and new yaml formats here
mock({
  '/ws/openfn.yaml': jsonToYaml({
    name: 'some-project-name',
    project: {
      uuid: '1234',
      name: 'some-project-name',
    },
    formats: {
      openfn: 'yaml',
      project: 'yaml',
      workflow: 'yaml',
      custom: true, // Note tha this will be excluded
    },
    // deliberately exclude dirs
    custom: true,
  }),
  '/ws/.projects/staging@app.openfn.org.yaml': jsonToYaml({
    id: 'some-id',
    name: 'some-project-name',
    workflows: [
      {
        name: 'simple-workflow',
        id: 'wf-id',
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
});

test('workspace-path: valid workspace path', (t) => {
  const ws = new Workspace('/ws');
  t.is(ws.valid, true);
});

test('workspace-path: invalid workspace path', (t) => {
  const ws = new Workspace('/invalid');
  t.is(ws.valid, false);
});

test('workspace-list: list projects in the workspace', (t) => {
  const ws = new Workspace('/ws');
  t.is(ws.list().length, 1);
  t.deepEqual(
    ws.list().map((w) => w.name),
    ['some-project-name']
  );
});

test('workspace-get: get projects in the workspace', (t) => {
  const ws = new Workspace('/ws');
  const found = ws.get('some-project-name');
  t.truthy(found);
  t.is(found?.workflows.length, 2);
  t.deepEqual(
    found?.workflows.map((w) => w.name),
    ['simple-workflow', 'another-workflow']
  );
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
  t.deepEqual(ws.projectMeta, {
    uuid: '1234',
    name: 'some-project-name',
  });
});
