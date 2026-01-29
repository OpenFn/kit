import type { Provisioner } from '@openfn/lexicon/lightning';

export const myProject_v1: Provisioner.Project = {
  id: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
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
        'cli:ba19e179317f', // alterstate
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
cli:
  version: 2
description: my lovely project
collections: []
credentials: []
openfn:
  uuid: e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00
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
        adaptor: "@openfn/language-common@latest"
        openfn:
          uuid: 66add020-e6eb-4eec-836b-20008afca816
      - id: webhook
        type: webhook
        openfn:
          enabled: true
          uuid: 4a06289c-15aa-4662-8dc6-f0aaacd8a058
        next:
          transform-data:
            disabled: false
            condition: always
            openfn:
              uuid: a9a3adef-b394-4405-814d-3ac4323f4b4b
    history:
      - cli:ba19e179317f
    openfn:
      uuid: 72ca3eb0-042c-47a0-a2a1-a545ed4a8406
      inserted_at: 2025-04-23T11:19:32Z
      updated_at: 2025-04-23T11:19:32Z
      lock_version: 1
    id: my-workflow
    start: webhook`;
