export const makeProject = (id: string) => ({
  id,
  name: 'test-project',
  workflows: [
    {
      id: 'my-workflow-1',
      name: 'My Workflow',
      jobs: [
        {
          id: 'my-job-1',
          name: 'My Job',
          body: 'fn(s => s)',
          adaptor: '@openfn/language-common@latest',
          project_credential_id: null,
        },
      ],
      triggers: [{ id: 'my-trigger-1', type: 'webhook', enabled: true }],
      edges: [
        {
          id: 'my-edge-1',
          condition_type: 'always',
          source_trigger_id: 'my-trigger-1',
          target_job_id: 'my-job-1',
          enabled: true,
        },
      ],
      lock_version: 1,
      deleted_at: null,
    },
  ],
  project_credentials: [],
  collections: [],
});

export const makeMultiProject = (id: string): any => ({
  id,
  name: 'test-project',
  workflows: [
    {
      id: 'my-workflow-1',
      name: 'My Workflow',
      jobs: [
        {
          id: 'my-job-1',
          name: 'My Job',
          body: 'fn(s => s)',
          adaptor: '@openfn/language-common@latest',
          project_credential_id: null,
        },
      ],
      triggers: [{ id: 'my-trigger-1', type: 'webhook', enabled: true }],
      edges: [
        {
          id: 'my-edge-1',
          condition_type: 'always',
          source_trigger_id: 'my-trigger-1',
          target_job_id: 'my-job-1',
          enabled: true,
        },
      ],
      lock_version: 1,
      deleted_at: null,
    },
    {
      id: 'another-workflow-1',
      name: 'Another Workflow',
      jobs: [
        {
          id: 'another-job-1',
          name: 'Another Job',
          body: "get('http://example.com')",
          adaptor: '@openfn/language-http@latest',
          project_credential_id: null,
        },
      ],
      triggers: [{ id: 'another-trigger-1', type: 'webhook', enabled: true }],
      edges: [
        {
          id: 'another-edge-1',
          condition_type: 'always',
          source_trigger_id: 'another-trigger-1',
          target_job_id: 'another-job-1',
          enabled: true,
        },
      ],
      lock_version: 1,
      deleted_at: null,
    },
  ],
  project_credentials: [],
  collections: [],
});
