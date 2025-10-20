import * as l from '@openfn/lexicon';
// bunch of util helpers because I think I'll need them!

// createProvisionerProject
// createProject
// createWorkflow
// createStep

// with metadata or just raw?
// randomise stuff like uuids, name?
export const createWorkflow = (props: l.Workflow) => ({
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
        'Transform data': {
          disabled: false,
          condition: true,
          openfn: {
            id: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
          },
        },
      },
    },
    {
      id: 'Transform data',
      expression: 'fn(s => s)',
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
  ...props,
});

export const createProject = (...props: l.Project) => {
  const p = {
    name: 'aaa',
    description: 'a project',
    env: 'staging',
    credentials: [],
    collections: [],
    openfn: {
      projectId: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
      endpoint: 'http://localhost:4000',
      inserted_at: '2025-04-23T11:15:59Z',
      updated_at: '2025-04-23T11:15:59Z',
    },
    meta: {
      fetched_at: 'abc',
    },
    options: {
      scheduled_deletion: null,
      allow_support_access: false,
      requires_mfa: false,
      retention_policy: 'retain_all',
      history_retention_period: null,
      dataclip_retention_period: null,
      concurrency: null,
    },
    workflows: [createWorkflow()],
  };

  Object.assign(p, props);

  return p;
};
