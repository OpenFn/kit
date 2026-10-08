import test from 'ava';
import { handler as list } from '../../src/projects/list';
import { createMockLogger } from '@openfn/logger';
import mock from 'mock-fs';
import { jsonToYaml } from '@openfn/project';

// a workspace with several projects but no checkout metadata
const noCheckoutProject = jsonToYaml({ id: 'my-project', workflows: [] });

const files: Record<string, any> = {
  'no-ws/': { 'some.yaml': 'name: smth' },
  '/no-checkout/openfn.yaml': '',
  '/no-checkout/.projects/main@app.openfn.org.yaml': noCheckoutProject,
  '/no-checkout/.projects/staging@app.openfn.org.yaml': noCheckoutProject,
  '/ws/openfn.yaml': jsonToYaml({
    project: {
      id: 'my-project',
      uuid: '<uuid:main>',
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
};

// the same workspace, with a workflow folder renamed to an alias
files['/aliased/openfn.yaml'] = files['/ws/openfn.yaml'];
files['/aliased/.projects/main@app.openfn.org.yaml'] =
  files['/ws/.projects/main@app.openfn.org.yaml'];
files['/aliased/workflows/sw/simple-workflow.yaml'] = jsonToYaml({
  id: 'simple-workflow',
  steps: [],
});

mock(files);

const logger = createMockLogger('', { level: 'debug' });

test('throw for invalid workspace directory', async (t) => {
  await t.throwsAsync(
    () => list({ command: 'projects', workspace: '/invalid' }, logger),
    {
      message: 'No OpenFn projects found at /invalid',
    }
  );
  // const { message } = logger._parse(logger._last);
  // t.is(message, 'Command was run in an invalid openfn workspace');
});

test('throw if dir is not a workspace', async (t) => {
  await t.throwsAsync(
    () => list({ command: 'projects', workspace: '/no-ws' }, logger),
    {
      message: 'No OpenFn projects found at /no-ws',
    }
  );
});

test('valid workspace', async (t) => {
  await list({ command: 'projects', workspace: '/ws' }, logger);

  const { message } = logger._find('always', /available openfn projects/i);
  t.is(
    `Available openfn projects

main | my-project (active)
  <uuid:main>
  workflows:
    - simple-workflow

staging | my-project 
  <uuid:staging>
  workflows:
    - simple-workflow
    - another-workflow
    `,
    message as string
  );
});

test('shows workflow aliases on the active project', async (t) => {
  const privateLogger = createMockLogger('', { level: 'debug' });
  await list({ command: 'projects', workspace: '/aliased' }, privateLogger);

  const { message } = privateLogger._find(
    'always',
    /available openfn projects/i
  );
  t.regex(message as string, /^    - simple-workflow \(sw\)$/m);
});

test.serial(
  'lists projects without a checkout, without prompting or aborting',
  async (t) => {
    const privateLogger = createMockLogger('', { level: 'debug' });

    await list(
      { command: 'projects', workspace: '/no-checkout' },
      privateLogger
    );

    const { message } = privateLogger._find(
      'always',
      /available openfn projects/i
    );
    t.regex(message as string, /^main \|/m);
    t.regex(message as string, /^staging \|/m);
    t.notRegex(message as string, /\(active\)/);
  }
);
