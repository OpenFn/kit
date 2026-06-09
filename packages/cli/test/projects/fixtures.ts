import type { Provisioner } from '@openfn/lexicon/lightning';

export const UUID = 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00';

export const myProject_v1: Provisioner.Project = {
  id: UUID,
  name: 'My Project',
  description: 'my lovely project',
  concurrency: null,
  inserted_at: '2025-04-23T11:15:59Z',
  collections: [],
  workflows: {
    'my-workflow': {
      id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
      name: 'My Workflow',
      edges: {
        'trigger-webhook': {
          enabled: true,
          id: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
          source_trigger_id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
          condition_type: 'always',
          target_job_id: '66add020-e6eb-4eec-836b-20008afca816',
        },
      },
      concurrency: null,
      inserted_at: '2025-04-23T11:19:32Z',
      updated_at: '2025-04-23T11:19:32Z',
      jobs: {
        'transform-data': {
          id: '66add020-e6eb-4eec-836b-20008afca816',
          name: 'Transform data',
          body: 'fn()',
          adaptor: '@openfn/language-common@latest',
          project_credential_id: null,
          keychain_credential_id: null,
        },
      },
      triggers: {
        webhook: {
          enabled: true, // TODO enabled: false is a bit interesting
          id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
          type: 'webhook',
        },
      },
      lock_version: 1,
      deleted_at: null,
      version_history: [
        'cli:7126e08da251', // alterstate
      ],
    },
  },
  updated_at: '2025-04-23T11:15:59Z',
  project_credentials: [],
  scheduled_deletion: null,
  allow_support_access: false,
  requires_mfa: false,
  retention_policy: 'retain_all',
  history_retention_period: null,
  dataclip_retention_period: null,
};

export const myProject_yaml = `id: my-project
name: My Project
schema_version: '4.0'
description: my lovely project
collections: []
credentials: []
openfn:
  uuid: ${UUID}
  endpoint: https://app.openfn.org
  inserted_at: 2025-04-23T11:15:59Z
  updated_at: 2025-04-23T11:15:59Z
options:
  allow_support_access: false
  requires_mfa: false
  retention_policy: retain_all
workflows:
  - name: My Workflow
    steps:
      - id: transform-data
        name: Transform data
        expression: fn()
        adaptor: '@openfn/language-common@latest'
        openfn:
          uuid: 66add020-e6eb-4eec-836b-20008afca816
      - id: webhook
        type: webhook
        enabled: true
        openfn:
          uuid: 4a06289c-15aa-4662-8dc6-f0aaacd8a058
        next:
          transform-data:
            disabled: false
            condition: always
            openfn:
              uuid: a9a3adef-b394-4405-814d-3ac4323f4b4b
    history:
      - cli:7126e08da251
    openfn:
      uuid: 72ca3eb0-042c-47a0-a2a1-a545ed4a8406
      inserted_at: 2025-04-23T11:19:32Z
      updated_at: 2025-04-23T11:19:32Z
      lock_version: 1
    id: my-workflow
    start: webhook`;

export const TWO_WORKFLOWS_UUID = '4b09ddf1-35f4-4e40-9aa9-0d80c086dd9e';

export const two_workflows_yaml = `id: my-project
name: My Project
schema_version: '4.0'
description: ''
collections: []
credentials: []
openfn:
  uuid: ${TWO_WORKFLOWS_UUID}
  endpoint: https://app.openfn.org
  inserted_at: 2025-04-23T11:15:59Z
  updated_at: 2025-04-23T11:15:59Z
options:
  allow_support_access: false
  requires_mfa: false
  retention_policy: retain_all
workflows:
  - id: workflow-a
    name: Workflow A
    steps:
      - id: job-a
        name: Job A
        expression: fn()
        adaptor: '@openfn/language-common@latest'
        openfn:
          uuid: 3d4727b6-4052-4f58-a834-3a03e433ff1d
      - id: trigger-a
        type: webhook
        enabled: true
        openfn:
          uuid: 1b1c1dd5-e8d9-432f-aeaf-4e09397cac98
        next:
          job-a:
            condition: always
            openfn:
              uuid: 1118353a-6015-40f9-8e57-51801a65bcfc
    openfn:
      uuid: 4584df01-cab4-4182-974d-6a75b13c7b97
      inserted_at: 2025-04-23T11:19:32Z
      updated_at: 2025-04-23T11:19:32Z
      lock_version: 1
    start: trigger-a
  - id: workflow-b
    name: Workflow B
    steps:
      - id: job-b
        name: Job B
        expression: fn()
        adaptor: '@openfn/language-common@latest'
        openfn:
          uuid: 37e6e616-3840-4d71-b63c-a736ebc208b7
      - id: trigger-b
        type: webhook
        enabled: true
        openfn:
          uuid: d65ed915-7f39-428b-af57-57ed2ecf507e
        next:
          job-b:
            condition: always
            openfn:
              uuid: 4b291d27-c055-40cd-b82d-210644338715
    openfn:
      uuid: fc5eeff6-537b-4667-841b-4d17c70dfab9
      inserted_at: 2025-04-23T11:19:32Z
      updated_at: 2025-04-23T11:19:32Z
      lock_version: 1
    start: trigger-b`;
