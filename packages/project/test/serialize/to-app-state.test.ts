import test from 'ava';
import type { Provisioner } from '@openfn/lexicon/lightning';
import { Project } from '../../src/Project';
import toAppState, { mapWorkflow } from '../../src/serialize/to-app-state';

const state: Provisioner.Project = {
  id: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
  name: 'aaa',
  description: 'a project',
  concurrency: null,
  inserted_at: '2025-04-23T11:15:59Z',
  collections: [],
  workflows: [
    {
      id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
      name: 'wf1',
      edges: [
        {
          enabled: true,
          id: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
          source_trigger_id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
          condition_type: 'always',
          target_job_id: '66add020-e6eb-4eec-836b-20008afca816',
        },
      ],
      concurrency: null,
      inserted_at: '2025-04-23T11:19:32Z',
      updated_at: '2025-04-23T11:19:32Z',
      jobs: [
        {
          id: '66add020-e6eb-4eec-836b-20008afca816',
          name: 'Transform data',
          body: '// Check out the Job Writing Guide for help getting started:\n// https://docs.openfn.org/documentation/jobs/job-writing-guide\n',
          adaptor: '@openfn/language-common@latest',
          project_credential_id: null,
        },
      ],
      triggers: [
        {
          enabled: true, // TODO enabled: false is a bit interesting
          id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
          type: 'webhook',
        },
      ],
      lock_version: 1,
      deleted_at: null,
    },
  ],
  updated_at: '2025-04-23T11:15:59Z',
  project_credentials: [],
  scheduled_deletion: null,
  allow_support_access: false,
  requires_mfa: false,
  retention_policy: 'retain_all',
  history_retention_period: null,
  dataclip_retention_period: null,
};

test('should convert a project back to app state in json', (t) => {
  // this is a serialized project file
  const data = {
    name: 'aaa',
    description: 'a project',
    credentials: [],
    collections: [],
    openfn: {
      env: 'project',
      projectId: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
      endpoint: 'http://localhost:4000',
      inserted_at: '2025-04-23T11:15:59Z',
      updated_at: '2025-04-23T11:15:59Z',
    },
    // TODO didn't we move fetched_at to openfn?
    meta: {
      fetched_at: 'abc',
    },
    // TODO need to ensure this is created on the other end
    options: {
      scheduled_deletion: null,
      allow_support_access: false,
      requires_mfa: false,
      retention_policy: 'retain_all',
      history_retention_period: null,
      dataclip_retention_period: null,
      concurrency: null,
    },
    workflows: [
      {
        name: 'wf1',
        steps: [
          {
            id: 'trigger',
            type: 'webhook',
            openfn: {
              enabled: true,
              id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
            },
            next: {
              'transform-data': {
                disabled: false,
                condition: true,
                openfn: {
                  id: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
                },
              },
            },
          },
          {
            id: 'transform-data',
            name: 'Transform data',
            expression:
              '// Check out the Job Writing Guide for help getting started:\n// https://docs.openfn.org/documentation/jobs/job-writing-guide\n',
            adaptor: '@openfn/language-common@latest',
            openfn: {
              id: '66add020-e6eb-4eec-836b-20008afca816',
              project_credential_id: null,
            },
          },
        ],
        openfn: {
          id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
          inserted_at: '2025-04-23T11:19:32Z',
          updated_at: '2025-04-23T11:19:32Z',
          lock_version: 1,
          deleted_at: null,
          concurrency: null,
        },
      },
    ],
  };
  const project = new Project(data, {
    formats: {
      project: 'json',
    },
  });

  const newState = toAppState(project);
  // t.log(JSON.stringify(newState, null, 2));
  t.deepEqual(newState, state);
});

test('should convert a project back to app state in yaml', (t) => {
  // this is a serialized project file
  const data = {
    name: 'aaa',
    description: 'a project',
    credentials: [],
    collections: [],
    openfn: {
      env: 'project',
      projectId: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
      endpoint: 'http://localhost:4000',
      inserted_at: '2025-04-23T11:15:59Z',
      updated_at: '2025-04-23T11:15:59Z',
    },
    meta: {
      fetched_at: 'abc',
    },
    // TODO need to ensure this is created on the other end
    options: {
      scheduled_deletion: null,
      allow_support_access: false,
      requires_mfa: false,
      retention_policy: 'retain_all',
      history_retention_period: null,
      dataclip_retention_period: null,
      concurrency: null,
    },
    workflows: [
      {
        name: 'wf1',
        steps: [
          {
            id: 'trigger',
            type: 'webhook',
            openfn: {
              enabled: true,
              id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
            },
            next: {
              'transform-data': {
                disabled: false,
                condition: true,
                openfn: {
                  id: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
                },
              },
            },
          },
          {
            id: 'transform-data',
            name: 'Transform data',
            expression:
              '// Check out the Job Writing Guide for help getting started:\n// https://docs.openfn.org/documentation/jobs/job-writing-guide\n',
            adaptor: '@openfn/language-common@latest',
            openfn: {
              id: '66add020-e6eb-4eec-836b-20008afca816',
              project_credential_id: null,
            },
          },
        ],
        openfn: {
          id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
          inserted_at: '2025-04-23T11:19:32Z',
          updated_at: '2025-04-23T11:19:32Z',
          lock_version: 1,
          deleted_at: null,
          concurrency: null,
        },
      },
    ],
  };
  const project = new Project(data, {
    formats: {
      project: 'yaml',
    },
  });

  const yaml = toAppState(project);
  t.deepEqual(
    yaml,
    `id: e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00
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
`
  );
});
