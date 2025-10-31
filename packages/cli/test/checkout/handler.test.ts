import test from 'ava';
import { createMockLogger } from '@openfn/logger';
import checkoutHandler from '../../src/checkout/handler';
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
      id: '<uuid:staging>>',
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

test.serial('get active project', (t) => {
  const workspace = new Workspace('/ws');
  t.is(workspace.valid, true);
  t.is(workspace.activeProjectId, 'my-project');
});

test.serial('checkout: invalid project id', (t) => {
  checkoutHandler(
    { command: 'checkout', projectId: 'not-known', projectPath: '/ws' },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Project with id/name not-known not found in the workspace');
});

test.serial('checkout: to a different valid project', async (t) => {
  // before checkout. my-project is active and expanded
  const bcheckout = new Workspace('/ws');
  t.is(bcheckout.activeProject.id, 'my-project');

  await checkoutHandler(
    { command: 'checkout', projectId: 'my-project', projectPath: '/ws' },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  // after checkout. my-project is active and expanded
  const acheckout = new Workspace('/ws');
  t.is(acheckout.activeProject.id, 'my-project');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow-main', 'another-workflow-main'].sort()
  );
});

test.serial('checkout: same id as active', async (t) => {
  // before checkout. my-project is active and expanded
  const bcheckout = new Workspace('/ws');
  t.is(bcheckout.activeProject.id, 'my-project');

  await checkoutHandler(
    {
      command: 'checkout',
      projectId: 'my-project',
      projectPath: '/ws',
    },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  // after checkout. my-project is active and expanded
  const acheckout = new Workspace('/ws');
  t.is(acheckout.activeProject.id, 'my-project');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow-main', 'another-workflow-main'].sort()
  );
});

test.serial('checkout: switching to and back between projects', async (t) => {
  // before checkout. my-project is active and expanded
  const bcheckout = new Workspace('/ws');
  t.is(bcheckout.activeProject.id, 'my-project');

  // 1. switch from my-project to my-staging
  await checkoutHandler(
    { command: 'checkout', projectId: 'my-staging', projectPath: '/ws' },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  // after checkout. my-staging is active and expanded
  const acheckout = new Workspace('/ws');
  t.is(acheckout.activeProject.id, 'my-staging');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow', 'another-workflow'].sort()
  );

  // 2. switch back from my-project to my-project
  await checkoutHandler(
    {
      command: 'checkout',
      projectId: 'my-project',
      projectPath: '/ws',
    },
    logger
  );
  const { message: lastMsg } = logger._parse(logger._last);
  t.is(lastMsg, 'Expanded project to /ws');

  // after checkout. my-project is active and expanded
  const fcheckout = new Workspace('/ws');
  t.is(fcheckout.activeProject.id, 'my-project');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow-main', 'another-workflow-main'].sort()
  );
});
