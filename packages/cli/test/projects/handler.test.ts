import test from 'ava';
import projectsHandler from '../../src/projects/handler';
import { createMockLogger } from '@openfn/logger';
import mock from 'mock-fs';
import { jsonToYaml } from '@openfn/project';

mock({
  'no-ws/': { 'some.yaml': 'name: smth' },
  '/ws/openfn.yaml': jsonToYaml({
    project: {
      id: 'my-project',
    },
    workspace: {
      dirs: {
        workflows: 'workflows',
      },
      formats: {
        openfn: 'yaml',
        project: 'yaml',
        workflow: 'yaml',
      },
    },
  }),
  // This is in the new v2 format!
  '/ws/.projects/main@app.openfn.org.yaml': jsonToYaml({
    name: 'My Project',
    openfn: {
      uuid: '<uuid:main>',
    },
    version: 2,
    workflows: [
      {
        id: 'simple-workflow',
        name: 'Simple Workflow',
        openfn: {
          uuid: '<uuid:wf>',
        },
        steps: [
          {
            type: 'webhook',
            enabled: true,
            next: {
              'job-a': {
                openfn: {
                  uuid: '<uuid:edge>',
                },
              },
            },
            openfn: {
              uuid: '<uuid:trigger>',
            },
          },
          {
            id: 'job-a',
            name: 'Transform data to FHIR standard',
            body: ' fn(state => state); // sdfl',
            adaptor: '@openfn/language-http@latest',
            openfn: {
              uuid: '<uuid:step>',
            },
          },
        ],
      },
    ],
  }),
  // This is in the old v1 format!
  '/ws/.projects/staging@app.openfn.org.yaml': jsonToYaml({
    id: '<uuid:staging>',
    name: 'My Project',
    workflows: [
      {
        name: 'Simple Workflow',
        id: '<uuid:wf1>',
        jobs: [
          {
            name: 'Transform data to FHIR standard',
            body: ' fn(state => state); // sdfl',
            adaptor: '@openfn/language-http@latest',
            id: '<uuid:job>>',
          },
        ],
        triggers: [
          {
            type: 'webhook',
            enabled: true,
            id: '<uuid:trigger>',
          },
        ],
        edges: [
          {
            id: '<uuid:edge>',
            target_job_id: '<uuid:job>>',
            enabled: true,
            source_trigger_id: '<uuid:trigger>',
            condition_type: 'always',
          },
        ],
      },
      {
        name: 'Another Workflow',
        id: '<uuid:wf2>',
        jobs: [
          {
            name: 'Transform data to FHIR standard',
            body: ' fn(state => state); // sdfl',
            adaptor: '@openfn/language-http@latest',
            id: '<uuid:job2>',
          },
        ],
        triggers: [
          {
            type: 'webhook',
            enabled: true,
            id: '<uuid:trigger2>',
          },
        ],
        edges: [
          {
            id: '<uuid:edge2>',
            target_job_id: '<uuid:job2>',
            enabled: true,
            source_trigger_id: '<uuid:trigger>',
            condition_type: 'always',
          },
        ],
      },
    ],
  }),
});

const logger = createMockLogger('', { level: 'debug' });

test('openfn projects: invalid workspace directory', (t) => {
  projectsHandler({ command: 'projects', projectPath: '/invalid' }, logger);
  const { message } = logger._parse(logger._last);
  t.is(message, 'Command was run in an invalid openfn workspace');
});

test('openfn projects: not a workspace', (t) => {
  projectsHandler({ command: 'projects', projectPath: '/no-ws' }, logger);
  const { message } = logger._parse(logger._last);
  t.is(message, 'Command was run in an invalid openfn workspace');
});

test('openfn projects: valid workspace', (t) => {
  projectsHandler({ command: 'projects', projectPath: '/ws' }, logger);
  const { message, level } = logger._parse(logger._last);
  t.is('success', level);
  t.is(
    `Available openfn projects

my-project (active)
  <uuid:main>
  workflows:
    - simple-workflow

my-project (active)
  <uuid:staging>
  workflows:
    - simple-workflow
    - another-workflow
    `,
    message as string
  );
});
