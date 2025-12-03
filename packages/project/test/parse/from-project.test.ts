import test from 'ava';
import state_v1 from '../fixtures/sample-v1-project';
import Project from '../../src/Project';
import * as v2 from '../fixtures/sample-v2-project';

test('import from a v1 state as JSON', async (t) => {
  const proj = await Project.from('project', state_v1, {});

  // make a few basic assertions about the project
  t.is(proj.id, 'my-workflow');
  t.is(proj.name, 'My Workflow');
  t.is(proj.openfn.uuid, 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00');
  t.is(proj.options.retention_policy, 'retain_all');

  t.is(proj.workflows.length, 1);
});

test('import from a v1 state as YAML', async (t) => {
  const yaml = `id: '1234'
name: aaa
description: a project
project_credentials: []
collections: []
inserted_at: 2025-04-23T11:15:59Z
updated_at: 2025-04-23T11:15:59Z
scheduled_deletion: null
allow_support_access: false
requires_mfa: false
retention_policy: retain_all
history_retention_period: null
dataclip_retention_period: null
concurrency: null
workflows:
  - name: wf1
    id: 72ca3eb0-042c-47a0-a2a1-a545ed4a8406
    inserted_at: 2025-04-23T11:19:32Z
    updated_at: 2025-04-23T11:19:32Z
    lock_version: 1
    deleted_at: null
    concurrency: null
    jobs:
      - name: Transform data
        body: |
          // Check out the Job Writing Guide for help getting started:
          // https://docs.openfn.org/documentation/jobs/job-writing-guide
        adaptor: "@openfn/language-common@latest"
        id: 66add020-e6eb-4eec-836b-20008afca816
        project_credential_id: null
    triggers:
      - type: webhook
        enabled: true
        id: 4a06289c-15aa-4662-8dc6-f0aaacd8a058
    edges:
      - id: a9a3adef-b394-4405-814d-3ac4323f4b4b
        target_job_id: 66add020-e6eb-4eec-836b-20008afca816
        enabled: true
        source_trigger_id: 4a06289c-15aa-4662-8dc6-f0aaacd8a058
        condition_type: always
  `;
  const proj = await Project.from('project', yaml, {});

  // make a few basic assertions about the project
  t.is(proj.id, 'aaa');
  t.is(proj.name, 'aaa');
  t.is(proj.openfn.uuid, '1234');
  t.is(proj.options.retention_policy, 'retain_all');

  t.is(proj.workflows.length, 1);
});

test('import from a v2 project as JSON', async (t) => {
  const proj = await Project.from('project', v2.json);

  t.is(proj.id, 'my-project');
  t.is(proj.name, 'My Project');
  t.is(proj.openfn!.uuid, '1234');
  t.is(proj.openfn!.endpoint, 'https://app.openfn.org');

  t.is(proj.workflows.length, 1);

  t.deepEqual(proj.workflows[0].workflow, {
    id: 'workflow',
    name: 'Workflow',
    openfn: {
      uuid: 1,
    },
    history: [],
    steps: [
      {
        name: 'b',
        id: 'b',
        expression: 'fn()',
        adaptor: 'common',
        openfn: {
          uuid: 3,
        },
      },
      {
        id: 'trigger',
        type: 'webhook',
        openfn: {
          uuid: 2,
        },
        next: {
          b: {
            openfn: {
              uuid: 4,
            },
          },
        },
      },
    ],
  });
});

test('import from a v2 project as YAML', async (t) => {
  const proj = await Project.from('project', v2.yaml);
  t.is(proj.id, 'my-project');
  t.is(proj.name, 'My Project');
  t.is(proj.openfn!.uuid, '1234');
  t.is(proj.openfn!.endpoint, 'https://app.openfn.org');
  // t.is(proj.options.retention_policy, 'retain_all');

  t.is(proj.workflows.length, 1);

  t.deepEqual(proj.workflows[0].workflow, {
    id: 'workflow',
    name: 'Workflow',
    openfn: {
      uuid: 1,
    },
    history: [],
    steps: [
      {
        name: 'b',
        id: 'b',
        expression: 'fn()',
        adaptor: 'common',
        openfn: {
          uuid: 3,
        },
      },
      {
        id: 'trigger',
        type: 'webhook',
        openfn: {
          uuid: 2,
        },
        next: {
          b: {
            openfn: {
              uuid: 4,
            },
          },
        },
      },
    ],
  });
});

test('import with custom config', async (t) => {
  const config = {
    x: 1234,
    dirs: {
      projects: 'p',
      workflows: 'w',
    },
  };
  const proj = await Project.from('project', v2.yaml, config);
  t.is(proj.id, 'my-project');

  t.deepEqual(proj.config, {
    dirs: {
      projects: 'p',
      workflows: 'w',
    },
    formats: {
      openfn: 'yaml',
      project: 'yaml',
      workflow: 'yaml',
    },
    x: 1234,
  });
});
