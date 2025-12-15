import test from 'ava';
import fromAppState, { mapWorkflow } from '../../src/parse/from-app-state';
import { clone, cloneDeep } from 'lodash-es';

import state, { withCreds } from '../fixtures/sample-v1-project';

// I don't think this file really represents anything
// loosely maps to the old config file
const meta = {
  endpoint: 'app.openfn.org',
  env: 'test',
};

test('should create a Project from prov state with basic metadata', (t) => {
  const project = fromAppState(state, meta);

  t.is(project.name, 'My Workflow');
  t.is(project.description, 'a project');
});

test('should create a Project from prov state with app project metadata', (t) => {
  const project = fromAppState(state, meta);

  t.deepEqual(project.openfn, {
    env: 'test',
    uuid: state.id,
    endpoint: meta.endpoint,
    inserted_at: state.inserted_at,
    updated_at: state.updated_at,
  });
});

test('should create a Project from prov state with options', (t) => {
  const project = fromAppState(state, meta);

  t.deepEqual(project.options, {
    scheduled_deletion: null,
    history_retention_period: null,
    dataclip_retention_period: null,
    allow_support_access: false,
    retention_policy: 'retain_all',
    concurrency: null,
    requires_mfa: false,
  });
});

test('should create a Project from prov state with collections', (t) => {
  const project = fromAppState(state, meta);

  t.deepEqual(project.collections, []);
});

test('should create a Project from prov state with credentials', (t) => {
  const project = fromAppState(state, meta);

  t.deepEqual(project.credentials, []);
});

test('should create a Project from prov state with positions', (t) => {
  const newState = cloneDeep(state);

  // assign a fake positions object
  // the provisioner right now doesn't include positions
  // - but one day it will, and Project needs to be able to sync it
  newState.workflows[0].positions = {
    x: 1,
    y: 1,
  };
  const project = fromAppState(newState, meta);

  t.deepEqual(project.workflows[0].openfn.positions, {
    x: 1,
    y: 1,
  });
});

test('should create a Project from prov state with a workflow', (t) => {
  const project = fromAppState(state, meta);

  t.is(project.workflows.length, 1);
  t.deepEqual(project.workflows[0].toJSON(), {
    id: 'my-workflow',
    name: 'My Workflow',
    history: [],
    steps: [
      {
        id: 'trigger',
        type: 'webhook',
        openfn: { enabled: true, uuid: '4a06289c-15aa-4662-8dc6-f0aaacd8a058' },
        next: {
          'transform-data': {
            condition: true,
            disabled: false,
            openfn: {
              uuid: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
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
          uuid: '66add020-e6eb-4eec-836b-20008afca816',
          project_credential_id: null,
          keychain_credential_id: null,
        },
      },
    ],
    openfn: {
      uuid: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
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
      'transform-data': {
        condition: true,
        disabled: false,
        openfn: {
          uuid: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
        },
      },
    },
    openfn: {
      enabled: true,
      uuid: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
    },
  });
});

test('mapWorkflow: handle openfn meta (uuid, lock_version, deleted_at)', (t) => {
  const mapped = mapWorkflow(state.workflows[0]);

  t.deepEqual(mapped.openfn, {
    lock_version: 1,
    deleted_at: null,
    concurrency: null,
    uuid: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
    updated_at: '2025-04-23T11:19:32Z',
    inserted_at: '2025-04-23T11:19:32Z',
  });
});

// TODO need to test various trigger conditions and states
test('mapWorkflow: map a simple job', (t) => {
  const mapped = mapWorkflow(state.workflows[0]);

  const [_trigger, job] = mapped.steps;
  t.deepEqual(job, {
    id: 'transform-data',
    name: 'Transform data',
    adaptor: '@openfn/language-common@latest',
    expression:
      '// Check out the Job Writing Guide for help getting started:\n// https://docs.openfn.org/documentation/jobs/job-writing-guide\n',
    openfn: {
      uuid: '66add020-e6eb-4eec-836b-20008afca816',
      project_credential_id: null,
      keychain_credential_id: null,
    },
  });
});

// todo surprised this works
test('mapWorkflow: map a job with project and keychain credentials', (t) => {
  const wf = withCreds.workflows[0];
  wf.jobs.map(console.log);
  const mapped = mapWorkflow(wf);

  const [_trigger, job] = mapped.steps;
  t.deepEqual(job, {
    id: 'transform-data',
    name: 'Transform data',
    adaptor: '@openfn/language-common@latest',
    expression:
      '// Check out the Job Writing Guide for help getting started:\n// https://docs.openfn.org/documentation/jobs/job-writing-guide\n',
    openfn: {
      uuid: '66add020-e6eb-4eec-836b-20008afca816',
      project_credential_id: 'p',
      keychain_credential_id: 'k',
    },
  });
});

test('should create a Project from prov state yaml', (t) => {
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

  const project = fromAppState(yaml, meta, {
    format: 'yaml',
  });

  t.is(project.name, 'aaa');
  t.is(project.description, 'a project');
  t.is(project.workflows.length, 1);
  t.is(project.workflows[0].name, 'wf1');
  t.is(project.workflows[0].steps.length, 2);
});
