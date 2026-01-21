import test from 'ava';
import { createMockLogger } from '@openfn/logger';
import { handler as checkoutHandler } from '../../src/projects/checkout';
import mock from 'mock-fs';
import fs from 'fs';
import { jsonToYaml, Workspace } from '@openfn/project';

test.beforeEach(() => {
  mock({
    '/ws/workflows': {},
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
      id: '<uuid:staging>',
      name: 'My Staging',
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
    '/ws/.projects/project@app.openfn.org.yaml': jsonToYaml({
      id: '<uuid:main>',
      name: 'My Project',
      workflows: [
        {
          name: 'simple-workflow-main',
          id: 'wf-id-main',
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
          name: 'another-workflow-main',
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
});

const logger = createMockLogger('', { level: 'debug' });

test.serial('checkout: invalid project id', async (t) => {
  await t.throwsAsync(
    () =>
      checkoutHandler(
        {
          command: 'project-checkout',
          project: 'not-known',
          workspace: '/ws',
        },
        logger
      ),
    {
      message: 'Project with id not-known not found in the workspace',
    }
  );
});

test.serial('checkout: to a different valid project', async (t) => {
  // before checkout. my-project is active and expanded
  const bcheckout = new Workspace('/ws');
  t.is(bcheckout.activeProject!.id, 'my-project');

  await checkoutHandler(
    { command: 'project-checkout', project: 'my-project', workspace: '/ws' },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  // after checkout. my-project is active and expanded
  const acheckout = new Workspace('/ws');
  t.is(acheckout.activeProject!.id, 'my-project');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow-main', 'another-workflow-main'].sort()
  );
});

test.serial('checkout: same id as active', async (t) => {
  // before checkout. my-project is active and expanded
  const bcheckout = new Workspace('/ws');
  t.is(bcheckout.activeProject!.id, 'my-project');

  await checkoutHandler(
    {
      command: 'project-checkout',
      project: 'my-project',
      workspace: '/ws',
    },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  // after checkout. my-project is active and expanded
  const acheckout = new Workspace('/ws');
  t.is(acheckout.activeProject!.id, 'my-project');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow-main', 'another-workflow-main'].sort()
  );
});

test.serial('checkout: switching to and back between projects', async (t) => {
  // before checkout. my-project is active and expanded
  const bcheckout = new Workspace('/ws');
  t.is(bcheckout.activeProject!.id, 'my-project');

  // 1. switch from my-project to my-staging
  await checkoutHandler(
    { command: 'project-checkout', project: 'my-staging', workspace: '/ws' },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  // after checkout. my-staging is active and expanded
  const acheckout = new Workspace('/ws');
  t.is(acheckout.activeProject!.id, 'my-staging');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow', 'another-workflow'].sort()
  );

  // 2. switch back from my-project to my-project
  await checkoutHandler(
    {
      command: 'project-checkout',
      project: 'my-project',
      workspace: '/ws',
      clean: true,
    },
    logger
  );
  const { message: lastMsg } = logger._parse(logger._last);
  t.is(lastMsg, 'Expanded project to /ws');

  // after checkout. my-project is active and expanded
  const fcheckout = new Workspace('/ws');
  t.is(fcheckout.activeProject!.id, 'my-project');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow-main', 'another-workflow-main'].sort()
  );
});

test.serial('checkout: switch with id', async (t) => {
  const before = new Workspace('/ws');
  t.is(before.activeProject!.id, 'my-project');

  await checkoutHandler(
    {
      command: 'project-checkout',
      project: 'my-staging',
      workspace: '/ws',
    },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  const after = new Workspace('/ws');
  t.is(after.activeProject!.id, 'my-staging');
});

test.serial('checkout: switch with alias', async (t) => {
  const before = new Workspace('/ws');
  t.is(before.activeProject!.id, 'my-project');

  await checkoutHandler(
    {
      command: 'project-checkout',
      project: 'staging', // this is actually an alias
      workspace: '/ws',
    },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  const after = new Workspace('/ws');
  t.is(after.activeProject!.id, 'my-staging');
});

// TODO this doesn't work locally because the serialized files in are in v1,
// and have no domain information attached
// This fuzzy match is better covered in the projects testing though
test.serial.skip('checkout: switch with alias and domain', async (t) => {
  const before = new Workspace('/ws');
  t.is(before.activeProject!.id, 'my-project');

  await checkoutHandler(
    {
      command: 'project-checkout',
      project: 'staging@app.openfn.org', // this is actually an alias
      workspace: '/ws',
    },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  // after checkout: staging is active and expanded
  const after = new Workspace('/ws');
  t.is(after.activeProject!.id, 'my-staging');
});

test.serial('respect openfn.yaml settings', async (t) => {
  mock({
    '/ws1/w': {},
    '/ws1/openfn.yaml': jsonToYaml({
      project: {
        id: 'main',
      },
      workspace: {
        dirs: {
          workflows: 'w',
          projects: 'p',
        },
        formats: {
          openfn: 'yaml', // TODO need to test that this can be JSON too
          project: 'json',
          workflow: 'json',
        },
      },
    }),
    '/ws1/p/staging@app.openfn.org.json': JSON.stringify({
      id: '<uuid:staging>',
      name: 'Staging',
      workflows: [
        {
          name: 'Simple Workflow',
          id: 'wf1',
          jobs: [
            {
              name: 'Transform data to FHIR standard',
              body: '.',
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
      ],
    }),
    '/ws1/p/project@app.openfn.org.json': JSON.stringify({
      id: '<uuid:main>',
      name: 'Main',
      workflows: [
        {
          name: 'simple-workflow-main',
          id: 'wf-id-main',
          jobs: [
            {
              name: 'Transform data to FHIR standard',
              body: 'fn(s => s)',
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
      ],
    }),
  });

  await checkoutHandler(
    {
      command: 'project-checkout',
      project: 'staging',
      workspace: '/ws1',
    },
    logger
  );

  // config file should be correct
  const yaml = fs.readFileSync('/ws1/openfn.yaml', 'utf8');
  t.is(
    yaml,
    `project:
  uuid: <uuid:staging>
  id: staging
  name: Staging
workspace:
  credentials: credentials.yaml
  dirs:
    projects: p
    workflows: w
  formats:
    openfn: yaml
    project: json
    workflow: json
`
  );

  // workflow file should be correct
  const wf = fs.readFileSync(
    '/ws1/w/simple-workflow/simple-workflow.json',
    'utf8'
  );

  t.deepEqual(JSON.parse(wf), {
    id: 'simple-workflow',
    name: 'Simple Workflow',
    options: {},
    start: 'webhook',
    steps: [
      {
        id: 'webhook',
        type: 'webhook',
        next: {
          'transform-data-to-fhir-standard': {
            disabled: false,
            condition: 'always',
          },
        },
      },
      {
        id: 'transform-data-to-fhir-standard',
        name: 'Transform data to FHIR standard',
        adaptor: '@openfn/language-http@latest',
        expression: './transform-data-to-fhir-standard.js',
      },
    ],
  });
});
