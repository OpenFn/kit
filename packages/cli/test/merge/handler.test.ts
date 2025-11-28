import Project, { jsonToYaml, Workspace } from '@openfn/project';
import test from 'ava';
import mock from 'mock-fs';
import mergeHandler from '../../src/merge/handler';
import { createMockLogger } from '@openfn/logger';

const sandbox = {
  id: '<uuid:sandbox>',
  name: 'My Sandbox',
  workflows: [
    {
      name: 'Workflow 1',
      id: 'workflow-1',
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
};
const main = {
  id: '<uuid:main>',
  name: 'My Project',
  workflows: [
    {
      name: 'Workflow 1',
      id: 'workflow-1',
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
};

test.beforeEach(() => {
  mock({
    '/ws/workflows': {},
    '/ws/openfn.yaml': jsonToYaml({
      project: {
        id: 'my-project',
        name: 'My Project',
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
    '/ws/.projects/staging@app.openfn.org.yaml': jsonToYaml(sandbox),
    '/ws/.projects/project@app.openfn.org.yaml': jsonToYaml(main),
  });
});

const logger = createMockLogger('', { level: 'debug' });

test.serial('merging into the same project', async (t) => {
  await mergeHandler(
    {
      command: 'merge',
      projectPath: '/ws',
      projectId: 'my-project',
      removeUnmapped: false,
      workflowMappings: {},
    },
    logger
  );

  const { message, level } = logger._parse(logger._last);
  t.is(level, 'error');
  t.regex(message, /Merging into the same project not allowed/);
});

test.serial('merging a different project into checked-out', async (t) => {
  // state of main projects workflow before sandbox is merged in
  const beforeWs = new Workspace('/ws');
  t.is(beforeWs.activeProject.id, 'my-project');
  const beforeProjects = beforeWs.list();
  t.is(beforeProjects[0].workflows[0].steps.length, 2);
  t.is(beforeProjects[0].workflows[0].steps[1].name, 'Job A');

  // do merging
  await mergeHandler(
    {
      command: 'merge',
      projectPath: '/ws',
      projectId: 'my-sandbox',
      removeUnmapped: false,
      workflowMappings: {},
    },
    logger
  );

  // state of main projects workflow AFTER sandbox is merged in
  const afterWorkspace = new Workspace('/ws');
  t.is(afterWorkspace.activeProject.id, 'my-project');
  const afterProjects = afterWorkspace.list();
  const wf = afterProjects[0].workflows[0];
  t.is(wf.steps.length, 3);
  t.is(wf.steps[1].name, 'Job X');
  t.is(wf.steps[1].openfn?.uuid, 'job-a'); // id got retained
  t.is(wf.steps[2].name, 'Job Y');
  t.is(wf.steps[2].openfn?.uuid, 'job-y'); // id not retained - new node

  const { message, level } = logger._parse(logger._last);
  t.is(level, 'success');
  t.is(
    message,
    'Project my-sandbox has been merged into Project my-project successfully'
  );
});

test.serial('Write to a different project file', async (t) => {
  // state of main projects workflow before sandbox is merged in
  const before = new Workspace('/ws');
  t.is(before.activeProject.id, 'my-project');

  // do merging
  await mergeHandler(
    {
      command: 'merge',
      projectPath: '/ws',
      projectId: 'my-sandbox',
      removeUnmapped: false,
      workflowMappings: {},
      outputPath: '/ws/backup.yaml',
    },
    logger
  );

  // Read in the state file and check it matches
  const merged = await Project.from('path', '/ws/backup.yaml');
  t.is(merged.id, 'my-project');
  t.is(merged.workflows[0].steps[1].name, 'Job X');
  t.is(merged.workflows[0].steps[1].openfn?.uuid, 'job-a'); // id got retained
});

test.serial(
  'Write to a different project file as JSON using extension',
  async (t) => {
    // state of main projects workflow before sandbox is merged in
    const before = new Workspace('/ws');
    t.is(before.activeProject.id, 'my-project');

    // do merging
    await mergeHandler(
      {
        command: 'merge',
        projectPath: '/ws',
        projectId: 'my-sandbox',
        removeUnmapped: false,
        workflowMappings: {},
        outputPath: '/ws/backup.json',
      },
      logger
    );

    // Read in the state file and check it matches
    const merged = await Project.from('path', '/ws/backup.json');
    t.is(merged.id, 'my-project');
    t.is(merged.workflows[0].steps[1].name, 'Job X');
    t.is(merged.workflows[0].steps[1].openfn?.uuid, 'job-a'); // id got retained
  }
);

test.serial('Write to JSON using project config', async (t) => {
  mock({
    '/ws/openfn.yaml': jsonToYaml({
      project: {
        id: 'my-project',
        name: 'My Project',
      },
      workspace: {
        dirs: {
          workflows: 'workflows',
        },
        formats: {
          openfn: 'yaml',
          project: 'json',
          workflow: 'yaml',
        },
      },
    }),
    '/ws/.projects/staging@app.openfn.org.json': JSON.stringify(sandbox),
    '/ws/.projects/project@app.openfn.org.json': JSON.stringify(main),
  });

  // state of main projects workflow before sandbox is merged in
  const before = new Workspace('/ws');
  t.is(before.activeProject.id, 'my-project');

  t.is(before.list()[0].workflows[0].steps[1].name, 'Job A');
  t.is(before.list()[0].workflows[0].steps[1].openfn?.uuid, 'job-a'); // id Aot retained

  // do merging
  await mergeHandler(
    {
      command: 'merge',
      projectPath: '/ws',
      projectId: 'my-sandbox',
      removeUnmapped: false,
      workflowMappings: {},
    },
    logger
  );

  // Read in the state file and check it matches
  const merged = await Project.from(
    'path',
    '/ws/.projects/project@app.openfn.org.json'
  );
  t.is(merged.id, 'my-project');
  t.is(merged.workflows[0].steps[1].name, 'Job X');
  t.is(merged.workflows[0].steps[1].openfn?.uuid, 'job-a'); // id got retained
});

test.serial('merge with custom base', async (t) => {
  mock({
    '/ws/openfn.yaml': jsonToYaml({
      project: {
        id: 'my-project',
        name: 'My Project',
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
    '/ws/.projects/staging@app.openfn.org.yaml': jsonToYaml(sandbox),
    '/ws/.projects/project@app.openfn.org.yaml': jsonToYaml(main),
    // This project has id main but a different name
    // If merging using just the active project, we'll have ambiguity
    // But we CAN merge it through --base flag
    '/ws/.projects/fake@app.openfn.org.yaml': jsonToYaml({
      ...main,
      name: 'FAKE PROJECT',
    }),
  });

  // state of main projects workflow before sandbox is merged in
  const before = new Workspace('/ws');
  t.is(before.activeProject.id, 'my-project');

  t.is(before.list()[0].workflows[0].steps[1].name, 'Job A');
  t.is(before.list()[0].workflows[0].steps[1].openfn?.uuid, 'job-a'); // id Aot retained

  // do merging
  await mergeHandler(
    {
      command: 'merge',
      projectPath: '/ws',
      projectId: 'my-sandbox',
      base: '/ws/.projects/project@app.openfn.org.yaml',
      removeUnmapped: false,
      workflowMappings: {},
    },
    logger
  );

  // Read in the state file and check it matches
  const merged = await Project.from(
    'path',
    '/ws/.projects/project@app.openfn.org.yaml'
  );
  t.is(merged.id, 'my-project');
  t.is(merged.name, 'My Project'); // not fake project!
  t.is(merged.workflows[0].steps[1].name, 'Job X');
  t.is(merged.workflows[0].steps[1].openfn?.uuid, 'job-a'); // id got retained
});
