import test from 'ava';
import { createMockLogger } from '@openfn/logger';
import { handler as cleanHandler } from '../../src/projects/clean';
import mock from 'mock-fs';
import fs from 'fs';
import { jsonToYaml } from '@openfn/project';

const logger = createMockLogger('', { level: 'debug' });

const projectStateFile = jsonToYaml({
  id: 'my-project',
  name: 'My Project',
  workflows: [
    {
      name: 'simple-workflow-main',
      id: 'wf-id-main',
      version_history: ['a'],
      jobs: [
        {
          name: 'Transform data',
          body: 'fn(state => state)',
          adaptor: '@openfn/language-http@latest',
          id: 'job-a',
        },
      ],
      triggers: [{ type: 'webhook', enabled: true, id: 'trigger-id' }],
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
});

test.beforeEach(() => {
  mock({
    '/ws/workflows/old-workflow': {
      'old-job.js': 'fn(s => s)',
    },
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
    '/ws/.projects/project@app.openfn.org.yaml': projectStateFile,
  });
});

test.afterEach(() => {
  mock.restore();
  logger._reset();
});

test.serial(
  'clean: removes existing workflows and checks out active project',
  async (t) => {
    t.true(fs.existsSync('/ws/workflows/old-workflow/old-job.js'));

    await cleanHandler(
      { command: 'project-clean', workspace: '/ws', force: true },
      logger
    );

    t.false(fs.existsSync('/ws/workflows/old-workflow'));
    t.deepEqual(fs.readdirSync('/ws/workflows'), ['simple-workflow-main']);
  }
);

test.serial('clean: shows a confirmation prompt before deleting', async (t) => {
  await cleanHandler({ command: 'project-clean', workspace: '/ws' }, logger);

  const confirm = logger._find('confirm', /workflows/);
  t.truthy(confirm);
});

test.serial('clean: aborts if user declines confirmation', async (t) => {
  const declineLogger = {
    ...logger,
    confirm: async () => false,
  };

  await cleanHandler(
    { command: 'project-clean', workspace: '/ws' },
    declineLogger as any
  );

  t.true(fs.existsSync('/ws/workflows/old-workflow/old-job.js'));
});

test.serial(
  'clean: throws if no active project found in workspace',
  async (t) => {
    mock({ '/ws/workflows': {} });

    await t.throwsAsync(
      () =>
        cleanHandler(
          { command: 'project-clean', workspace: '/ws', force: true },
          logger
        ),
      { message: /No active project found/ }
    );
  }
);
