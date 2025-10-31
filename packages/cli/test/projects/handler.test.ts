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
      workflowRoot: 'workflows',
      formats: {
        openfn: 'yaml',
        project: 'yaml',
        workflow: 'yaml',
      },
    },
  }),
  '/ws/.projects/staging@app.openfn.org.yaml': jsonToYaml({
    id: '<uuid:main>',
    name: 'my-project',
    workflows: [
      {
        name: 'simple-workflow',
        id: 'wf-id',
        jobs: [
          {
            name: 'Transform data to FHIR standard',
            body: ' fn(state => state); // sdfl',
            adaptor: '@openfn/language-http@latest',
            id: 'job-a',
          },
        ],
        triggers: [
          {
            type: 'webhook',
            enabled: true,
            id: 'trigger-id',
          },
        ],
        edges: [
          {
            id: 'edge-id',
            target_job_id: 'job-a',
            enabled: true,
            source_trigger_id: 'trigger-id',
            condition_type: 'always',
          },
        ],
      },
      {
        name: 'another-workflow',
        id: 'another-id',
        jobs: [
          {
            name: 'Transform data to FHIR standard',
            body: ' fn(state => state); // sdfl',
            adaptor: '@openfn/language-http@latest',
            id: 'job-b',
          },
        ],
        triggers: [
          {
            type: 'webhook',
            enabled: true,
            id: 'trigger-id',
          },
        ],
        edges: [
          {
            id: 'edge-id',
            target_job_id: 'job-b',
            enabled: true,
            source_trigger_id: 'trigger-id',
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

test.only('openfn projects: valid workspace', (t) => {
  projectsHandler({ command: 'projects', projectPath: '/ws' }, logger);
  const { message, level } = logger._parse(logger._last);
  t.is('success', level);
  t.is(
    `Available openfn projects

my-project (active)
  <uuid:main>
  workflows:
    - simple-workflow
    - another-workflow
    `,
    message as string
  );
});
