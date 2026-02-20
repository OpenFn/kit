import Project, { jsonToYaml, Workspace } from '@openfn/project';
import test from 'ava';
import mock from 'mock-fs';
import { handler as mergeHandler } from '../../src/projects/merge';
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
        id: 'my-sandbox',
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
      command: 'project-merge',
      workspace: '/ws',
      project: 'my-sandbox',
      removeUnmapped: false,
      workflowMappings: {},
    },
    logger
  );

  const { message, level } = logger._parse(logger._last);
  t.is(level, 'error');
  t.regex(message as string, /Merging into the same project not allowed/);
});

test.serial('merging a different project into checked-out', async (t) => {
  // state of main project workflow before sandbox is merged in
  const beforeWs = new Workspace('/ws');

  // sandbox is checked out
  t.is(beforeWs.activeProject!.id, 'my-sandbox');

  const beforeProjects = beforeWs.list();
  const mainBefore = beforeProjects.find((p) => p.id === 'my-project');
  t.is(mainBefore!.workflows[0].steps.length, 2);
  t.is(mainBefore!.workflows[0].steps[1].name, 'Job A');

  // do merging - merge checked-out (sandbox) into main (project)
  await mergeHandler(
    {
      command: 'project-merge',
      workspace: '/ws',
      project: 'my-project',
      removeUnmapped: false,
      workflowMappings: {},
    },
    logger
  );

  // state of main projects workflow AFTER sandbox is merged in
  const afterWorkspace = new Workspace('/ws');
  t.is(afterWorkspace.activeProject!.id, 'my-project');

  const afterProjects = afterWorkspace.list();
  const mainAfter = afterProjects.find((p) => p.id === 'my-project');
  const wf = mainAfter!.workflows[0];
  t.is(wf.steps.length, 3);
  t.is(wf.steps[1].name, 'Job X');
  t.is(wf.steps[1].openfn?.uuid, 'job-a'); // id got retained from target
  t.is(wf.steps[2].name, 'Job Y');
  t.is(wf.steps[2].openfn?.uuid, 'job-y'); // id not retained - new node

  const { message, level } = logger._parse(logger._last);
  t.is(level, 'success');
  t.is(message, 'Project my-sandbox has been merged into Project my-project');
});

test.serial('Write to a different project file', async (t) => {
  // state of main project workflow before sandbox is merged in
  const before = new Workspace('/ws');
  t.is(before.activeProject!.id, 'my-sandbox');

  // do merging - merge checked-out (my-sandbox) into main, outputting to custom path
  await mergeHandler(
    {
      command: 'project-merge',
      workspace: '/ws',
      project: 'my-project',
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
  t.is(merged.workflows[0].steps[1].openfn?.uuid, 'job-a'); // id got retained from target
});

test.serial(
  'Write to a different project file as JSON using extension',
  async (t) => {
    // state of main project workflow before sandbox is merged in
    const before = new Workspace('/ws');
    t.is(before.activeProject!.id, 'my-sandbox');

    // do merging - merge checked-out (my-sandbox) into main, outputting to custom JSON path
    await mergeHandler(
      {
        command: 'project-merge',
        workspace: '/ws',
        project: 'my-project',
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
    t.is(merged.workflows[0].steps[1].openfn?.uuid, 'job-a'); // id got retained from target
  }
);

test.serial('Write to JSON using project config', async (t) => {
  mock({
    '/ws/openfn.yaml': jsonToYaml({
      project: {
        id: 'my-sandbox',
        name: 'My Sandbox',
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

  // state of main project workflow before sandbox is merged in
  const before = new Workspace('/ws');
  t.is(before.activeProject!.id, 'my-sandbox');

  const mainBefore = before.list().find((p) => p.id === 'my-project');
  t.is(mainBefore!.workflows[0].steps[1].name, 'Job A');
  t.is(mainBefore!.workflows[0].steps[1].openfn?.uuid, 'job-a');

  // do merging - merge checked-out (my-sandbox) into main
  await mergeHandler(
    {
      command: 'project-merge',
      workspace: '/ws',
      project: 'my-project',
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
  t.is(merged.workflows[0].steps[1].openfn?.uuid, 'job-a'); // id got retained from target
});

test.serial('merge with custom source', async (t) => {
  mock({
    '/ws/openfn.yaml': jsonToYaml({
      project: {
        id: 'my-sandbox',
        name: 'My Sandbox',
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
    // But we CAN merge it through --source flag
    '/ws/.projects/fake@app.openfn.org.yaml': jsonToYaml({
      ...main,
      name: 'FAKE PROJECT',
    }),
  });

  // state of main project workflow before it gets merged with custom source
  const before = new Workspace('/ws');
  t.is(before.activeProject!.id, 'my-sandbox');

  const mainBefore = before.list().find((p) => p.id === 'my-project');
  const [_trigger, step] = mainBefore!.workflows[0].steps;
  t.is(step.name, 'Job A');
  t.is(step.openfn?.uuid, 'job-a');

  await mergeHandler(
    {
      command: 'project-merge',
      workspace: '/ws',
      project: 'my-project',
      source: '/ws/.projects/project@app.openfn.org.yaml',
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
  t.is(merged.workflows[0].steps[1].name, 'Job A');
  t.is(merged.workflows[0].steps[1].openfn?.uuid, 'job-a'); // id got retained from target
});
