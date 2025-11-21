import test from 'ava';
import state_v1 from '../fixtures/sample-v1-project';
import Project from '../../src/Project';
import { SerializedProject } from '../../src/parse/from-project';
import { project } from '../../src/util/version';

// THi

// Note that this will have no metadata stuff
// I suppose we could be smart and look for config.json?
// Just want a single fairly basic test here
//
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
  const yaml = `id: e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00
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
  t.is(proj.openfn.uuid, 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00');
  t.is(proj.options.retention_policy, 'retain_all');

  t.is(proj.workflows.length, 1);
});

// this is basically just new Project
test('import from a v2 project as JSON', async (t) => {
  const json: SerializedProject = {
    id: 'my-project',
    name: 'My Project',
    description: 'a project',
    version: 2, // important! This is how we know its a v2
    openfn: {
      uuid: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
      domain: 'https://app.openfn.org',
      inserted_at: '2025-04-23T11:15:59Z',
      updated_at: '2025-04-23T11:15:59Z',
    },
    meta: {
      // alias: 'main' // TODO not really implemented yet
    },
    options: {
      allow_support_access: false,
      requires_mfa: false,
      retention_policy: 'retain_all',
      // Note that null values are excluded
    },
    workflows: [
      {
        id: 'my-workflow',
        name: 'My Workflow',
        openfn: {
          uuid: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
          inserted_at: '2025-04-23T11:19:32Z',
          updated_at: '2025-04-23T11:19:32Z',
          lock_version: 1,
        },
        // TODO how do I want to serialize this stuff?
        // just keep lightning keys yeah?
        // uuids are not consistent though
        edges: [
          {
            id: 'webhook->transform-data',
            source_trigger_id: 'webhook',
            condition_type: 'always',
            target_job_id: 'transform-data',
            openfn: {
              enabled: true,
              uuid: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
            },
          },
        ],
        jobs: [
          {
            id: 'transform-data',
            name: 'Transform data',
            body: '// Check out the Job Writing Guide for help getting started:\n// https://docs.openfn.org/documentation/jobs/job-writing-guide\n',
            adaptor: '@openfn/language-common@latest',
            openfn: {
              uuid: '66add020-e6eb-4eec-836b-20008afca816',
            },
          },
        ],
        triggers: [
          {
            id: 'webhook',
            type: 'webhook',
            openfn: {
              uuid: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
              enabled: true,
            },
          },
        ],
      },
    ],
  };
  const proj = await Project.from('project', json);
  t.is(proj.id, 'my-project');
  t.is(proj.name, 'My Project');
  t.is(proj.openfn!.uuid, 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00');
  t.is(proj.openfn!.domain, 'https://app.openfn.org');
  t.is(proj.options.retention_policy, 'retain_all');

  t.is(proj.workflows.length, 1);

  t.deepEqual(proj.workflows[0].workflow, {
    id: 'my-workflow',
    name: 'My Workflow',
    steps: [
      {
        id: 'webhook',
        type: 'webhook',
        openfn: { uuid: '4a06289c-15aa-4662-8dc6-f0aaacd8a058', enabled: true },
        next: {
          'transform-data': {
            disabled: false,
            condition: true,
            openfn: { uuid: 'webhook->transform-data' },
          },
        },
      },
      {
        id: 'transform-data',
        name: 'Transform data',
        expression:
          '// Check out the Job Writing Guide for help getting started:\n// https://docs.openfn.org/documentation/jobs/job-writing-guide\n',
        adaptor: '@openfn/language-common@latest',
        openfn: { uuid: '66add020-e6eb-4eec-836b-20008afca816' },
      },
    ],
    openfn: {
      uuid: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
      inserted_at: '2025-04-23T11:19:32Z',
      updated_at: '2025-04-23T11:19:32Z',
      lock_version: 1,
    },
    history: [],
  });
});

test('import from a v2 project as YAML', async (t) => {
  const yaml = `id: my-project
name: My Project
description: a project
version: 2
openfn:
  uuid: e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00
  domain: https://app.openfn.org
  inserted_at: 2025-04-23T11:15:59Z
  updated_at: 2025-04-23T11:15:59Z
meta: {}
options:
  allow_support_access: false
  requires_mfa: false
  retention_policy: retain_all
workflows:
  - id: my-workflow
    name: My Workflow
    openfn:
      uuid: 72ca3eb0-042c-47a0-a2a1-a545ed4a8406
      inserted_at: 2025-04-23T11:19:32Z
      updated_at: 2025-04-23T11:19:32Z
      lock_version: 1
    edges:
      - id: webhook->transform-data
        source_trigger_id: webhook
        condition_type: always
        target_job_id: transform-data
        openfn:
          enabled: true
          uuid: a9a3adef-b394-4405-814d-3ac4323f4b4b
    jobs:
      - id: transform-data
        name: Transform data
        body: |
          // Check out the Job Writing Guide for help getting started:
          // https://docs.openfn.org/documentation/jobs/job-writing-guide
        adaptor: "@openfn/language-common@latest"
        openfn:
          uuid: 66add020-e6eb-4eec-836b-20008afca816
    triggers:
      - id: webhook
        type: webhook
        openfn:
          uuid: 4a06289c-15aa-4662-8dc6-f0aaacd8a058
          enabled: true
`;
  const proj = await Project.from('project', yaml);
  t.is(proj.id, 'my-project');
  t.is(proj.name, 'My Project');
  t.is(proj.openfn!.uuid, 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00');
  t.is(proj.openfn!.domain, 'https://app.openfn.org');
  t.is(proj.options.retention_policy, 'retain_all');

  t.is(proj.workflows.length, 1);

  t.deepEqual(proj.workflows[0].workflow, {
    id: 'my-workflow',
    name: 'My Workflow',
    steps: [
      {
        id: 'webhook',
        type: 'webhook',
        openfn: { uuid: '4a06289c-15aa-4662-8dc6-f0aaacd8a058', enabled: true },
        next: {
          'transform-data': {
            disabled: false,
            condition: true,
            openfn: { uuid: 'webhook->transform-data' },
          },
        },
      },
      {
        id: 'transform-data',
        name: 'Transform data',
        expression:
          '// Check out the Job Writing Guide for help getting started:\n// https://docs.openfn.org/documentation/jobs/job-writing-guide\n',
        adaptor: '@openfn/language-common@latest',
        openfn: { uuid: '66add020-e6eb-4eec-836b-20008afca816' },
      },
    ],
    openfn: {
      uuid: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
      inserted_at: '2025-04-23T11:19:32Z',
      updated_at: '2025-04-23T11:19:32Z',
      lock_version: 1,
    },
    history: [],
  });
});
