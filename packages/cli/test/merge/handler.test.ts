import { jsonToYaml, Workspace } from '@openfn/project/dist';
import test from 'ava';
import mock from 'mock-fs';
import mergeHandler from '../../src/merge/handler';
import { createMockLogger } from '@openfn/logger';

test.beforeEach(() => {
  mock({
    '/ws/workflows': {},
    '/ws/openfn.yaml': jsonToYaml({
      name: 'main-project-id',
      workflowRoot: 'workflows',
      formats: {
        openfn: 'yaml',
        project: 'yaml',
        workflow: 'yaml',
      },
    }),
    '/ws/.projects/staging@app.openfn.org.yaml': jsonToYaml({
      id: 'sandbox-uuid',
      name: 'sandbox-project-id',
      workflows: [
        {
          name: 'first-workflow',
          id: 'first-workflow-id',
          jobs: [
            {
              id: 'job-x',
              name: 'Job X',
              expression: '// something related to X',
            },
            {
              id: 'job-y',
              name: 'Job Y',
              expression: '// something related to Y',
            },
          ],
          triggers: [
            {
              type: 'cron',
              enabled: true,
              id: 'trigger-id',
            },
          ],
          edges: [
            {
              id: 'edge-trigger-x',
              target_job_id: 'job-x',
              enabled: true,
              source_trigger_id: 'trigger-id',
              condition_type: 'always',
            },
            {
              id: 'job-x-job-y',
              target_job_id: 'job-y',
              enabled: true,
              source_job_id: 'job-x',
              condition_type: 'always',
            },
          ],
        },
      ],
    }),
    '/ws/.projects/project@app.openfn.org.yaml': jsonToYaml({
      id: 'main-project-uuid',
      name: 'main-project-id',
      workflows: [
        {
          name: 'first-workflow',
          id: 'first-workflow-id',
          jobs: [{ id: 'job-a', name: 'Job A' }],
          triggers: [
            {
              type: 'cron',
              enabled: true,
              id: 'trigger-id',
            },
          ],
          edges: [
            {
              id: 'edge-trigger-a',
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
});

const logger = createMockLogger('', { level: 'debug' });

test('merging into the same project', async (t) => {
  await mergeHandler(
    {
      command: 'merge',
      projectPath: '/ws',
      projectName: 'main-project-id',
      removeUnmapped: false,
      workflowMappings: {},
    },
    logger
  );

  const { message, level } = logger._parse(logger._last);
  t.is(level, 'error');
  t.is(message, 'Merging into the same project not allowed');
});

test('merging a different project into checked-out', async (t) => {
  // state of main projects workflow before sandbox is merged in
  const bworkspace = new Workspace('/ws');
  t.is(bworkspace.projectMeta.name, 'main-project-id');
  t.is(bworkspace.getActiveProject()?.name, 'main-project-id');
  const bprojects = bworkspace.list();
  t.is(bprojects[0].workflows[0].steps.length, 2);
  t.is(bprojects[0].workflows[0].steps[1].name, 'Job A');

  // do merging
  await mergeHandler(
    {
      command: 'merge',
      projectPath: '/ws',
      projectName: 'sandbox-project-id',
      removeUnmapped: false,
      workflowMappings: {},
    },
    logger
  );

  // state of main projects workflow before sandbox is merged in
  const workspace = new Workspace('/ws');
  t.is(workspace.projectMeta.name, 'main-project-id');
  t.is(workspace.getActiveProject()?.name, 'main-project-id');
  const projects = workspace.list();
  t.is(projects[0].workflows[0].steps.length, 3);
  t.is(projects[0].workflows[0].steps[1].name, 'Job X');
  t.is(projects[0].workflows[0].steps[1].openfn?.uuid, 'job-a'); // id got retained
  t.is(projects[0].workflows[0].steps[2].name, 'Job Y');
  t.is(projects[0].workflows[0].steps[2].openfn?.uuid, 'job-y'); // id not retained - new nod

  const { message, level } = logger._parse(logger._last);
  t.is(level, 'success');
  t.is(
    message,
    'Project sandbox-project-id has been merged into Project main-project-id successfully'
  );
});
