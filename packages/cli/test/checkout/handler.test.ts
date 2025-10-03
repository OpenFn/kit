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
      name: 'some-project-name',
      workflowRoot: 'workflows',
      formats: {
        openfn: 'yaml',
        project: 'yaml',
        workflow: 'yaml',
      },
    }),
    '/ws/.projects/staging@app.openfn.org.yaml': jsonToYaml({
      id: 'some-id',
      name: 'some-project-name',
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
      id: 'main-id',
      name: 'main-project-id',
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
  t.is(workspace.activeProjectId, 'some-project-name');
});

test.serial('checkout: invalid project id', (t) => {
  checkoutHandler(
    { command: 'checkout', projectName: 'not-known', projectPath: '/ws' },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Project with id/name not-known not found in the workspace');
});

test.serial('checkout: to a different valid project', async (t) => {
  // before checkout. some-project-name is active and expanded
  const bcheckout = new Workspace('/ws');
  t.is(bcheckout.getConfig()?.name, 'some-project-name');
  t.is(bcheckout.getActiveProject()?.name, 'some-project-name');

  await checkoutHandler(
    { command: 'checkout', projectName: 'main-project-id', projectPath: '/ws' },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  // after checkout. main-project-id is active and expanded
  const acheckout = new Workspace('/ws');
  t.is(acheckout.getConfig()?.name, 'main-project-id');
  t.is(acheckout.getActiveProject()?.name, 'main-project-id');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow-main', 'another-workflow-main'].sort()
  );
});

test.serial('checkout: same id as active', async (t) => {
  // before checkout. some-project-name is active and expanded
  const bcheckout = new Workspace('/ws');
  t.is(bcheckout.getConfig()?.name, 'some-project-name');
  t.is(bcheckout.getActiveProject()?.name, 'some-project-name');

  await checkoutHandler(
    { command: 'checkout', projectName: 'some-project-name', projectPath: '/ws' },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  // after checkout. main-project-id is active and expanded
  const acheckout = new Workspace('/ws');
  t.is(acheckout.getConfig()?.name, 'some-project-name');
  t.is(acheckout.getActiveProject()?.name, 'some-project-name');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow', 'another-workflow'].sort()
  );
});

test.serial('checkout: switching to and back between projects', async (t) => {
  // before checkout. some-project-name is active and expanded
  const bcheckout = new Workspace('/ws');
  t.is(bcheckout.getConfig()?.name, 'some-project-name');
  t.is(bcheckout.getActiveProject()?.name, 'some-project-name');

  // 1. switch from some-project-name to main-project-id
  await checkoutHandler(
    { command: 'checkout', projectName: 'main-project-id', projectPath: '/ws' },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  // after checkout. main-project-id is active and expanded
  const acheckout = new Workspace('/ws');
  t.is(acheckout.getConfig()?.name, 'main-project-id');
  t.is(acheckout.getActiveProject()?.name, 'main-project-id');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow-main', 'another-workflow-main'].sort()
  );

  // 2. switch back from main-project-id to some-project-name
  await checkoutHandler(
    { command: 'checkout', projectName: 'some-project-name', projectPath: '/ws' },
    logger
  );
  const { message: lastMsg } = logger._parse(logger._last);
  t.is(lastMsg, 'Expanded project to /ws');

  // after checkout. main-project-id is active and expanded
  const fcheckout = new Workspace('/ws');
  t.is(fcheckout.getConfig()?.name, 'some-project-name');
  t.is(fcheckout.getActiveProject()?.name, 'some-project-name');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow', 'another-workflow'].sort()
  );
});
