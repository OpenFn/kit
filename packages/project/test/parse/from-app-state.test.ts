import test from 'ava';
import type { Provisioner } from '@openfn/lexicon/lightning';
import fromAppState, { mapWorkflow } from '../../src/parse/from-app-state';

// I don't think this file really represents anything
// loosely maps to the old config file
const config = {
  endpoint: 'app.openfn.org',
  env: 'test',
};

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

test('should create a Project from prov state with basic metadata', (t) => {
  const project = fromAppState(state, config);

  t.is(project.name, 'aaa');
  t.is(project.env, 'test');
  t.is(project.description, 'a project');
});

test('should create a Project from prov state with app project metadata', (t) => {
  const project = fromAppState(state, config);

  t.deepEqual(project.openfn, {
    projectId: state.id,
    endpoint: config.endpoint,
    inserted_at: state.inserted_at,
    updated_at: state.updated_at,
    fetched_at: undefined,
  });
});

test('should create a Project from prov state with a workflow', (t) => {
  const project = fromAppState(state, config);

  t.is(project.workflows.length, 1);
  t.deepEqual(project.workflows[0], {
    name: 'wf1',
    steps: [
      {
        id: 'trigger',
        type: 'webhook',
        openfn: { enabled: true, id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058' },
        next: { 'Transform data': true },
      },
      {
        id: 'Transform data',
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
      concurrency: null,
      inserted_at: '2025-04-23T11:19:32Z',
      updated_at: '2025-04-23T11:19:32Z',
      lock_version: 1,
      deleted_at: null,
    },
  });
});

test('mapWorkflow: map a simple trigger', (t) => {
  const mapped = mapWorkflow(state.workflows[0]);

  const [trigger] = mapped.steps;

  t.deepEqual(trigger, {
    id: 'trigger',
    type: 'webhook',
    next: {
      'Transform data': true,
    },
    openfn: {
      enabled: true,
      id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
    },
  });
});

// TODO need to test various trigger conditions and states
test('mapWorkflow: map a simple job', (t) => {
  const mapped = mapWorkflow(state.workflows[0]);

  const [_trigger, job] = mapped.steps;
  t.deepEqual(job, {
    adaptor: '@openfn/language-common@latest',
    expression:
      '// Check out the Job Writing Guide for help getting started:\n// https://docs.openfn.org/documentation/jobs/job-writing-guide\n',
    id: 'Transform data',
    openfn: {
      id: '66add020-e6eb-4eec-836b-20008afca816',
      project_credential_id: null,
    },
  });
});
