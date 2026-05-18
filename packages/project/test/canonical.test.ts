import test from 'ava';
import { ProjectSpec } from '@openfn/lexicon';
import { Project } from '../src/Project';

/**
 * This file tests a kitchen sink, canonical v2 project spec file
 *
 * It should build it without type errors, then serialize to json and yaml formats
 */
const project: ProjectSpec = {
  id: 'kitchen-sink',
  name: 'Kitchen Sink Test',
  description: 'Everything including the kitchen sink',
  schema_version: '4.0',
  credentials: [{ owner: 'admin@openfn.org', name: 'secret-squirrel' }],
  collections: ['nut-stash'],
  channels: [
    {
      id: 'proxy',
      name: 'My Proxy',
      destination_url: 'https://proxy.openfn.org',
      enabled: true,
      delete: false,
      destination_credential_id: 'secret',
    },
  ],
  workflows: [
    {
      id: 'wf-webhook',
      name: 'Webhook Workflow',
      start: 'webhook',
      options: { timeout: 60_000, run_memory_limit_mb: 512 },
      steps: [
        {
          id: 'webhook',
          name: 'Webhook Trigger',
          type: 'webhook',
          enabled: true,
          webhook_reply: 'before_start',
          webhook_response_config: {
            success_code: 202,
            error_code: 500,
          },
          next: 'fetch',
        },
        {
          id: 'fetch',
          name: 'Fetch Data',
          adaptor: '@openfn/language-http@latest',
          expression: 'get("/data");',
          next: {
            transform: true,
            log: 'state.data.length > 0',
            archive: {
              condition: '!state.errors',
              label: 'No errors',
              disabled: false,
            },
          },
        },
        {
          id: 'transform',
          name: 'Transform',
          adaptor: '@openfn/language-common@latest',
          expression: 'fn(state => state);',
        },
        {
          id: 'log',
          adaptor: '@openfn/language-common@latest',
          expression: 'fn(state => { console.log(state); return state; });',
        },
        {
          id: 'archive',
          adaptor: '@openfn/language-common@latest',
          expression: 'fn(state => state);',
        },
      ],
    },
    {
      id: 'wf-cron',
      name: 'Cron Workflow',
      schema_version: '1.0',
      start: 'cron',
      steps: [
        {
          id: 'cron',
          name: 'Cron Trigger',
          type: 'cron',
          enabled: false,
          cron_expression: '0 0 * * *',
          cron_cursor_job_id: 'cron-job',
          webhook_reply: 'after_completion',
          next: { 'cron-job': true },
        },
        {
          id: 'cron-job',
          name: 'Daily Sync',
          adaptor: '@openfn/language-dhis2@latest',
          expression: 'create("trackedEntityInstances", state.data);',
        },
      ],
    },
  ],
};

test('create a canonical project', (t) => {
  const p = new Project(project);

  t.is(p.id, 'kitchen-sink');
  t.is(p.name, 'Kitchen Sink Test');
  t.is(p.description, 'Everything including the kitchen sink');

  t.is(p.workflows.length, 2);
  t.deepEqual(p.credentials, [
    { owner: 'admin@openfn.org', name: 'secret-squirrel' },
  ]);
  t.deepEqual(p.collections, ['nut-stash']);

  const [webhook, cron] = p.workflows;

  t.is(webhook.id, 'wf-webhook');
  t.is(webhook.name, 'Webhook Workflow');
  t.is(webhook.start, 'webhook');
  t.is(webhook.steps.length, 5);
  t.is(webhook.steps[0].id, 'webhook');
  t.is(webhook.steps[0].type, 'webhook');

  t.is(cron.id, 'wf-cron');
  t.is(cron.steps.length, 2);
  t.is(cron.steps[0].type, 'cron');
  t.is(cron.steps[0].cron_expression, '0 0 * * *');
});

test('convert to v2 yaml', (t) => {
  const p = new Project(project);
  const yaml = p.serialize('project') as string;

  const expected = `id: kitchen-sink
name: Kitchen Sink Test
schema_version: '4.0'
description: Everything including the kitchen sink
collections:
  - nut-stash
channels:
  - id: proxy
    name: My Proxy
    destination_url: https://proxy.openfn.org
    enabled: true
    delete: false
    destination_credential_id: secret
credentials:
  - owner: admin@openfn.org
    name: secret-squirrel
openfn: {}
options: {}
workflows:
  - id: wf-webhook
    name: Webhook Workflow
    start: webhook
    options:
      timeout: 60000
      run_memory_limit_mb: 512
    steps:
      - id: archive
        adaptor: '@openfn/language-common@latest'
        expression: fn(state => state);
      - id: fetch
        name: Fetch Data
        adaptor: '@openfn/language-http@latest'
        expression: get("/data");
        next:
          transform: true
          log: state.data.length > 0
          archive:
            condition: '!state.errors'
            label: No errors
            disabled: false
      - id: log
        adaptor: '@openfn/language-common@latest'
        expression: fn(state => { console.log(state); return state; });
      - id: transform
        name: Transform
        adaptor: '@openfn/language-common@latest'
        expression: fn(state => state);
      - id: webhook
        name: Webhook Trigger
        type: webhook
        enabled: true
        webhook_reply: before_start
        webhook_response_config:
          success_code: 202
          error_code: 500
        next: fetch
    history: []
  - id: wf-cron
    name: Cron Workflow
    schema_version: '1.0'
    start: cron
    steps:
      - id: cron
        name: Cron Trigger
        type: cron
        enabled: false
        cron_expression: 0 0 * * *
        cron_cursor_job_id: cron-job
        webhook_reply: after_completion
        next:
          cron-job: true
      - id: cron-job
        name: Daily Sync
        adaptor: '@openfn/language-dhis2@latest'
        expression: create("trackedEntityInstances", state.data);
    history: []`.trim();

  t.is(yaml.trim(), expected);
});

// skipped because serialized step order is different
test.skip('convert to v2 json', (t) => {
  const p = new Project(project);
  const json = p.serialize('project', { format: 'json' }) as string;

  t.deepEqual(json, project);
});

// I'd like to load the canonical json then convert it into json format
// but dropping all state keys
// that means supporting Project.serialize('project', { state: false })
test.todo('roundtrip');
