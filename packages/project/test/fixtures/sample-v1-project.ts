import type { Provisioner } from '@openfn/lexicon/lightning';
import { cloneDeep } from 'lodash-es';

const state: Provisioner.Project = {
  id: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
  name: 'My Project',
  description: 'a project',
  concurrency: null,
  inserted_at: '2025-04-23T11:15:59Z',
  collections: [],
  workflows: {
    'webhook-workflow': {
      id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
      name: 'Webhook Workflow',
      edges: {
        'trigger->transform-data': {
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
          body: 'fn(s => s)',
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
    },
    'cron-workflow': {
      id: 'd63934ea-6144-4dd3-b7a0-aa4e65d6129c',
      name: 'Cron Workflow',
      edges: {
        'trigger->transform-data': {
          enabled: true,
          id: 'ee2b2cdf-ebd3-48f6-9176-488233fc00b5',
          source_trigger_id: 'f2ebf159-d401-4b42-9815-143edb6a6ba0',
          condition_type: 'always',
          target_job_id: '8f30f10f-5e77-46ca-a603-c1fe70a2802e',
        },
      },
      concurrency: null,
      inserted_at: '2025-04-23T11:19:32Z',
      updated_at: '2025-04-23T11:19:32Z',
      jobs: {
        'transform-data': {
          id: 'e0c6bd0b-3320-4e5f-ac08-36d2ae2405bc',
          name: 'Transform data',
          body: 'fn(s => s)',
          adaptor: '@openfn/language-common@latest',
          project_credential_id: null,
          keychain_credential_id: null,
        },
      },
      triggers: {
        cron: {
          enabled: true,
          id: '7ab78a65-81e7-4269-8aaf-ef70a80957ed',
          type: 'cron',
        },
      },
      lock_version: 1,
      deleted_at: null,
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

export default state;

const withCreds = cloneDeep(state);
// TODO I'm not sure about keychain creds hre
withCreds.project_credentials = [
  {
    id: 'p',
    name: 'My Credential',
    owner: 'admin@openfn.org',
  },
];
Object.assign(withCreds.workflows['webhook-workflow'].jobs['transform-data'], {
  project_credential_id: 'p',
  keychain_credential_id: 'k',
});

export { withCreds };
