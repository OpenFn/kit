import test from 'ava';
import fromAppState, {
  mapEdge,
  mapWorkflow,
  recordedStepIdsOf,
} from '../../src/parse/from-app-state';
import { cloneDeep } from 'lodash-es';

import state, { withCreds } from '../fixtures/sample-v1-project';
import { Job } from '@openfn/lexicon';

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

test('should create a Project from prov state with channels', (t) => {
  const channels = [
    {
      id: 'chan-1',
      name: 'webhook-out',
      destination_url: 'https://example.com/hook',
      enabled: true,
      destination_credential_id: null,
    },
  ];
  const stateWithChannels: any = { ...state, channels };

  const project = fromAppState(stateWithChannels, meta);

  t.deepEqual(project.channels, channels);
});

test('project channels is undefined when missing from state', (t) => {
  const project = fromAppState(state, meta);

  t.is(project.channels, undefined);
});

test('should create a Project from prov state with sandbox stuff', (t) => {
  const stateWithSandbox = {
    ...state,
    color: 'red',
    parent_id: 'abc',
    env: 'dev',
  };
  const project = fromAppState(stateWithSandbox, meta, { format: 'json' });

  t.is(project.sandbox!.parentId, 'abc');
  t.is(project.options.env, 'dev');
  t.is(project.options.color, 'red');
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
  newState.workflows['my-workflow'].positions = {
    step1: {
      x: 1,
      y: 1,
    },
  };
  const project = fromAppState(newState, meta);

  t.deepEqual(project.workflows[0].openfn!.positions, {
    step1: {
      x: 1,
      y: 1,
    },
  });
});

test('should handle project credentials', (t) => {
  const newState = cloneDeep(withCreds);

  const project = fromAppState(newState, meta);

  t.is(project.credentials.length, 1);
  t.is(
    project.workflows[0].steps[1].configuration,
    'admin@openfn.org|My Credential'
  );
});

test('should create a Project from prov state with a workflow', (t) => {
  const project = fromAppState(state, meta);

  t.is(project.workflows.length, 1);
  t.deepEqual(project.workflows[0].toJSON(), {
    id: 'my-workflow',
    name: 'My Workflow',
    history: [],
    start: 'webhook',
    steps: [
      {
        id: 'webhook',
        type: 'webhook',
        enabled: true,
        openfn: { uuid: '4a06289c-15aa-4662-8dc6-f0aaacd8a058' },
        next: {
          'transform-data': {
            condition: 'always',
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
        expression: 'fn(s => s)',
        adaptor: '@openfn/language-common@latest',
        openfn: {
          uuid: '66add020-e6eb-4eec-836b-20008afca816',
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

test('mapWorkflow: map a cron trigger', (t) => {
  const mapped = mapWorkflow({
    id: 'cron',
    name: 'w',
    deleted_at: null,
    triggers: {
      cron: {
        id: '1234',
        type: 'cron',
        cron_expression: '0 1 0 0',
        cron_cursor_job_id: 'x',
        enabled: true,
      },
    },
    jobs: {},
    edges: {},
  });

  const [trigger] = mapped.steps;
  t.deepEqual(trigger, {
    id: 'cron',
    type: 'cron',
    next: {},
    enabled: true,
    cron_expression: '0 1 0 0',
    cron_cursor_job_id: 'x',
    openfn: {
      uuid: '1234',
    },
  });
});

test('mapWorkflow: map a webhook trigger', (t) => {
  const mapped = mapWorkflow({
    ...state.workflows['my-workflow'],
    triggers: {
      webhook: {
        id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
        type: 'webhook',
        enabled: true,
        webhook_reply: 'before_start',
        webhook_response_config: {
          success_code: 202,
          error_code: 500,
        },
      },
    },
  });

  const [trigger] = mapped.steps;

  t.deepEqual(trigger, {
    id: 'webhook',
    type: 'webhook',
    enabled: true,
    webhook_reply: 'before_start',
    webhook_response_config: {
      success_code: 202,
      error_code: 500,
    },
    next: {
      'transform-data': {
        condition: 'always',
        disabled: false,
        openfn: {
          uuid: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
        },
      },
    },
    openfn: {
      uuid: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
    },
  });
});

test('mapWorkflow: use a triggers type as its id', (t) => {
  const wf = state.workflows['my-workflow'];

  // trigger id in the state is a UUID
  t.is(wf.triggers.webhook.id, '4a06289c-15aa-4662-8dc6-f0aaacd8a058');

  const mapped = mapWorkflow(wf);
  const [trigger] = mapped.steps;

  // trigger ID in the Project is the type
  t.is(trigger.id, 'webhook');
});

test('mapWorkflow: handle openfn meta (uuid, lock_version, deleted_at)', (t) => {
  const mapped = mapWorkflow(state.workflows['my-workflow']);

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
  const mapped = mapWorkflow(state.workflows['my-workflow']);

  const [_trigger, job] = mapped.steps;
  t.deepEqual(job, {
    id: 'transform-data',
    name: 'Transform data',
    adaptor: '@openfn/language-common@latest',
    expression: 'fn(s => s)',
    openfn: {
      uuid: '66add020-e6eb-4eec-836b-20008afca816',
      keychain_credential_id: null,
    },
  });
});

test('mapWorkflow: map a job with keychain credentials onto .openfn', (t) => {
  const wf = withCreds.workflows['my-workflow'];
  const mapped = mapWorkflow(wf);

  const [_trigger, job] = mapped.steps;

  // this is the important bit
  t.is((job as any).openfn.keychain_credential_id, 'k');

  // But may as well do this too
  t.deepEqual(job, {
    id: 'transform-data',
    name: 'Transform data',
    adaptor: '@openfn/language-common@latest',
    configuration: 'p', // note that without a credential map, this gets left alone
    expression: 'fn(s => s)',
    openfn: {
      uuid: '66add020-e6eb-4eec-836b-20008afca816',
      keychain_credential_id: 'k',
    },
  });
});

test('mapWorkflow: map a job with project credentials onto job.configuration', (t) => {
  const wf = withCreds.workflows['my-workflow'];
  const credentials = [
    {
      uuid: 'p',
      owner: 'admin',
      name: 'cred',
    },
  ];
  const mapped = mapWorkflow(wf, credentials);

  const [_trigger, job] = mapped.steps;

  // This is the important bit
  t.is((job as Job).configuration, 'admin|cred');

  t.deepEqual(job, {
    id: 'transform-data',
    name: 'Transform data',
    adaptor: '@openfn/language-common@latest',
    expression: 'fn(s => s)',
    configuration: 'admin|cred',
    openfn: {
      uuid: '66add020-e6eb-4eec-836b-20008afca816',
      keychain_credential_id: 'k',
    },
  });
});

test('mapEdge: map enabled state', (t) => {
  let e;

  e = mapEdge({} as any);
  t.deepEqual(e, {
    disabled: true,
  });

  e = mapEdge({
    enabled: true,
  } as any);
  t.deepEqual(e, {
    disabled: false,
  });

  e = mapEdge({
    enabled: false,
  } as any);
  t.deepEqual(e, {
    disabled: true,
  });
});

test('mapEdge: map UUID', (t) => {
  const e = mapEdge({
    id: 'abc',
  } as any);
  t.deepEqual(e, {
    disabled: true,
    openfn: {
      uuid: 'abc',
    },
  });
});

test('mapEdge: map label', (t) => {
  const e = mapEdge({
    condition_label: 'abc',
  } as any);
  t.deepEqual(e, {
    disabled: true,
    label: 'abc',
  });
});

test('mapEdge: map conditions', (t) => {
  let e;

  // basically any condition type should just map
  e = mapEdge({
    condition_type: 'always',
  } as any);
  t.deepEqual(e, {
    disabled: true,
    condition: 'always',
  });

  e = mapEdge({
    condition_type: 'on_job_success',
  } as any);
  t.deepEqual(e, {
    disabled: true,
    condition: 'on_job_success',
  });

  e = mapEdge({
    condition_type: 'jam',
  } as any);
  t.deepEqual(e, {
    disabled: true,
    condition: 'jam',
  });

  // But js expression should override
  e = mapEdge({
    condition_type: 'js_expression',
    condition_expression: 'abc',
  } as any);
  t.deepEqual(e, {
    disabled: true,
    condition: 'abc',
  });
});

// TODO the workflow yaml is not a project yaml
// so this test doesn't work
// I'll need to pull the project yaml, with uuids, to get this to work
test.skip('mapWorkflow: map edge conditions', () => {
  // TODO for yaml like this:
  const yaml = `
workflows:
  - name: Edge Conditions
    jobs:
      - Transform-data:
        name: Transform data
        adaptor: "@openfn/language-common@latest"
        body: assert($.ok)
      - sucess:
        name: sucess
        adaptor: "@openfn/language-common@latest"
        body: log('All ok!')
      - fail:
        name: fail
        adaptor: "@openfn/language-common@latest"
        body: log('everything is terrible')
      - custom:
        name: custom
        adaptor: "@openfn/language-common@latest"
        body: |
          // Check out the Job Writing Guide for help getting started:
          // https://docs.openfn.org/documentation/jobs/job-writing-guide
    triggers:
      - webhook:
          type: webhook
          enabled: true
    edges:
      - webhook->Transform-data:
          condition_type: always
          enabled: true
          target_job: Transform-data
          source_trigger: webhook
      - Transform-data->sucess:
          condition_type: on_job_success
          enabled: true
          target_job: sucess
          source_job: Transform-data
      - Transform-data->fail:
          condition_type: on_job_failure
          enabled: true
          target_job: fail
          source_job: Transform-data
      - Transform-data->custom:
          condition_type: js_expression
          enabled: true
          target_job: custom
          source_job: Transform-data
          condition_expression: state.ok == 22

`;
  fromAppState(yaml, meta, {
    format: 'yaml',
  });
  // const { next } = project.workflows['my-workflow'].steps[1];
  // make sure that the condition_types get mapped to condition
  // also make sure that custom conditions work (both ways)
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

// --- recorded step ids ---------------------------------------------------
//
// An id derived from a name loses whatever is not url-safe, so two names that
// differ only in emoji or an accent used to land on the same id and one step's
// code was written over the other on the way to disk.

const twoStepsSharingAnId = () => ({
  id: 'p1',
  name: 'demo',
  project_credentials: [],
  workflows: [
    {
      id: 'wf-uuid',
      name: 'My Workflow',
      triggers: {},
      edges: {},
      jobs: {
        j1: {
          id: 'bbbb',
          name: 'step \u{1F44D}',
          body: 'up()',
          adaptor: 'common',
        },
        j2: {
          id: 'aaaa',
          name: 'step \u{1F44E}',
          body: 'down()',
          adaptor: 'common',
        },
      },
    },
  ],
});

// name -> id, so a test can tell "both are distinct" from "they swapped"
const idsByName = (project: any, index = 0) =>
  Object.fromEntries(
    (Object.values(project.workflows)[index] as any).steps.map((s: any) => [
      s.name,
      s.id,
    ])
  );

test('two names that shorten to the same id still get distinct ids', (t) => {
  const ids = idsByName(fromAppState(twoStepsSharingAnId() as any, meta));

  t.is(Object.keys(ids).length, 2);
  t.is(new Set(Object.values(ids)).size, 2);
});

test('both step bodies reach the filesystem', (t) => {
  const project = fromAppState(twoStepsSharingAnId() as any, meta);

  const files = project.serialize('fs') as Record<string, string>;
  const scripts = Object.keys(files).filter((f) => f.endsWith('.js'));

  t.is(scripts.length, 2);
  t.true(Object.values(files).some((c) => c.includes('up()')));
  t.true(Object.values(files).some((c) => c.includes('down()')));
});

test('an id we have already written down is kept', (t) => {
  const project = fromAppState(twoStepsSharingAnId() as any, meta, {
    recordedStepIds: {
      'My Workflow': {
        'step \u{1F44D}': 'thumbs-up',
        'step \u{1F44E}': 'thumbs-down',
      },
    },
  });

  t.deepEqual(idsByName(project), {
    'step \u{1F44D}': 'thumbs-up',
    'step \u{1F44E}': 'thumbs-down',
  });
});

test('a step keeps its own id rather than swapping with its neighbour', (t) => {
  const state: any = twoStepsSharingAnId();
  const reversed: any = twoStepsSharingAnId();
  reversed.workflows[0].jobs = {
    j2: reversed.workflows[0].jobs.j2,
    j1: reversed.workflows[0].jobs.j1,
  };

  t.deepEqual(
    idsByName(fromAppState(state, meta)),
    idsByName(fromAppState(reversed, meta))
  );
});

test('a step named after a trigger does not take the trigger id', (t) => {
  const state: any = twoStepsSharingAnId();
  state.workflows[0].triggers = {
    t: { id: 'tttt', type: 'webhook', enabled: true },
  };
  state.workflows[0].jobs.j1.name = 'Webhook';

  const project = fromAppState(state, meta);
  const files = project.serialize('fs') as Record<string, string>;

  t.not(idsByName(project)['Webhook'], 'webhook');
  t.is(Object.keys(files).filter((f) => f.endsWith('.js')).length, 2);
});

test('two workflows can each hold a step of the same name', (t) => {
  const state: any = {
    id: 'p',
    name: 'demo',
    project_credentials: [],
    workflows: [
      {
        id: 'w1',
        name: 'One',
        triggers: {},
        edges: {},
        jobs: {
          a: { id: 'u-a', name: 'Transform', body: 'one()', adaptor: 'c' },
        },
      },
      {
        id: 'w2',
        name: 'Two',
        triggers: {},
        edges: {},
        jobs: {
          b: { id: 'u-b', name: 'Transform', body: 'two()', adaptor: 'c' },
        },
      },
    ],
  };

  const first = fromAppState(state, meta);
  const recorded = recordedStepIdsOf(first);

  // each workflow keeps its own entry rather than one overwriting the other
  t.deepEqual(Object.keys(recorded).sort(), ['One', 'Two']);

  const second = fromAppState(state, meta, { recordedStepIds: recorded });
  t.deepEqual(idsByName(second, 0), idsByName(first, 0));
  t.deepEqual(idsByName(second, 1), idsByName(first, 1));
});

test('a step named like an object property does not pick one up', (t) => {
  const state: any = twoStepsSharingAnId();
  state.workflows[0].jobs.j1.name = 'constructor';
  state.workflows[0].jobs.j2.name = 'toString';

  const project = fromAppState(state, meta);
  const ids = Object.values(idsByName(project));
  const files = project.serialize('fs') as Record<string, string>;

  t.true(ids.every((id) => typeof id === 'string' && id.length > 0));
  t.is(new Set(ids).size, 2);
  t.is(Object.keys(files).filter((f) => f.endsWith('.js')).length, 2);
});

test('an id from a project file that escapes the directory is ignored', (t) => {
  const project = fromAppState(twoStepsSharingAnId() as any, meta, {
    recordedStepIds: {
      'My Workflow': { 'step \u{1F44D}': '../../../../tmp/pwned' },
    },
  });

  const files = project.serialize('fs') as Record<string, string>;

  t.false(Object.values(idsByName(project)).includes('../../../../tmp/pwned'));
  t.false(Object.keys(files).some((f) => f.includes('..')));
});

test('a project on disk hands back the ids it already gave its steps', (t) => {
  const first = fromAppState(twoStepsSharingAnId() as any, meta);

  const second = fromAppState(twoStepsSharingAnId() as any, meta, {
    recordedStepIds: recordedStepIdsOf(first),
  });

  t.deepEqual(idsByName(second), idsByName(first));
});

test('the recorded ids are not written into the workspace config', (t) => {
  const project = fromAppState(twoStepsSharingAnId() as any, meta, {
    recordedStepIds: { 'My Workflow': { 'step \u{1F44D}': 'thumbs-up' } },
  });

  const files = project.serialize('fs') as Record<string, string>;

  t.false(JSON.stringify(files).includes('recordedStepIds'));
});
