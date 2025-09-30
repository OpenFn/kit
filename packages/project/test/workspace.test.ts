import mock from 'mock-fs';
import { jsonToYaml, Workspace } from '../src';
import test from 'ava';

mock({
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
