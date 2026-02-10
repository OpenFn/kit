import test from 'ava';
import Project, { generateWorkflow } from '@openfn/project';
import {
  findLocallyChangedWorkflows,
  tidyWorkflowDir,
} from '../../src/projects/util';

test('tidyWorkflowDir: removes workflows that no longer exist', async (t) => {
  const currentProject = new Project({
    name: 'current',
    workflows: [
      generateWorkflow('@id A trigger-x'),
      generateWorkflow('@id B trigger-y'),
    ],
  });

  const incomingProject = new Project({
    name: 'incoming',
    workflows: [
      generateWorkflow('@id A trigger-x'),
      generateWorkflow('@id D trigger-w'),
    ],
  });

  const toRemove = await tidyWorkflowDir(currentProject, incomingProject, true);

  t.deepEqual(toRemove, ['workflows/B/B.yaml']);
});

test('tidyWorkflowDir: do nothing when no workflows are removed', async (t) => {
  const currentProject = new Project({
    name: 'current',
    workflows: [generateWorkflow('@id A trigger-x')],
  });

  const incomingProject = new Project({
    name: 'incoming',
    workflows: [
      generateWorkflow('@id A trigger-x'),
      generateWorkflow('@id B trigger-y'),
    ],
  });

  const toRemove = await tidyWorkflowDir(currentProject, incomingProject, true);

  t.deepEqual(toRemove, []);
});

test('tidyWorkflowDir: removes all workflows when incoming project is empty', async (t) => {
  const currentProject = new Project({
    name: 'current',
    workflows: [
      generateWorkflow('@id A trigger-x'),
      generateWorkflow('@id B trigger-y'),
    ],
  });

  const incomingProject = new Project({
    name: 'incoming',
    workflows: [],
  });

  const toRemove = await tidyWorkflowDir(currentProject, incomingProject, true);

  // All workflows should be removed
  t.deepEqual(toRemove, ['workflows/A/A.yaml', 'workflows/B/B.yaml']);
});

test('tidyWorkflowDir: both projects empty', async (t) => {
  const currentProject = new Project({
    name: 'current',
    workflows: [],
  });

  const incomingProject = new Project({
    name: 'incoming',
    workflows: [],
  });

  const toRemove = await tidyWorkflowDir(currentProject, incomingProject, true);

  t.deepEqual(toRemove, []);
});

test('tidyWorkflowDir: identical projects', async (t) => {
  const currentProject = new Project({
    name: 'current',
    workflows: [
      generateWorkflow('@id A trigger-x'),
      generateWorkflow('@id B trigger-y'),
    ],
  });

  const incomingProject = new Project({
    name: 'incoming',
    workflows: [
      generateWorkflow('@id A trigger-x'),
      generateWorkflow('@id B trigger-y'),
    ],
  });

  const toRemove = await tidyWorkflowDir(currentProject, incomingProject, true);

  t.deepEqual(toRemove, []);
});

test('tidyWorkflowDir: complete replacement with no overlap', async (t) => {
  const currentProject = new Project({
    name: 'current',
    workflows: [
      generateWorkflow('@id A trigger-x'),
      generateWorkflow('@id B trigger-y'),
    ],
  });

  const incomingProject = new Project({
    name: 'incoming',
    workflows: [
      generateWorkflow('@id X trigger-x'),
      generateWorkflow('@id Y trigger-y'),
    ],
  });

  const toRemove = await tidyWorkflowDir(currentProject, incomingProject, true);

  t.deepEqual(toRemove, ['workflows/A/A.yaml', 'workflows/B/B.yaml']);
});

test('tidyWorkflowDir: handles undefined projects', async (t) => {
  const project = new Project({
    name: 'project',
    workflows: [generateWorkflow('@id A trigger-x')],
  });

  // Both undefined
  let toRemove = await tidyWorkflowDir(undefined, undefined, true);
  t.deepEqual(toRemove, []);

  // Current undefined
  toRemove = await tidyWorkflowDir(undefined, project, true);
  t.deepEqual(toRemove, []);

  // Incoming undefined
  toRemove = await tidyWorkflowDir(project, undefined, true);
  t.deepEqual(toRemove, []);
});

test('tidyWorkflowDir: removes expression files when workflow steps change', async (t) => {
  const currentProject = new Project({
    name: 'current',
    workflows: [generateWorkflow('@id A trigger-x(expression=fn)')],
  });

  const incomingProject = new Project({
    name: 'incoming',
    workflows: [generateWorkflow('@id A trigger-z(expression=fn)')],
  });

  const toRemove = await tidyWorkflowDir(currentProject, incomingProject, true);

  t.deepEqual(toRemove, ['workflows/A/x.js']);
});

test('findLocallyChangedWorkflows: no changed workflows', async (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');

  const hash1 = wf1.getVersionHash();
  const hash2 = wf2.getVersionHash();

  const project = new Project({
    name: 'test',
    workflows: [wf1, wf2],
  });

  // Create a mock workspace with forked_from that matches current hashes
  const workspace = {
    activeProject: {
      forked_from: {
        a: hash1,
        b: hash2,
      },
    },
  } as any;

  const changed = await findLocallyChangedWorkflows(workspace, project);
  t.deepEqual(changed, []);
});

test('findLocallyChangedWorkflows: all workflows changed if there is no forked_from', async (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');

  const project = new Project({
    name: 'test',
    workflows: [wf1, wf2],
  });

  // Create a mock workspace with NO forked_from
  const workspace = {
    activeProject: {},
  } as any;

  const changed = await findLocallyChangedWorkflows(workspace, project);
  t.deepEqual(changed, ['a', 'b']);
});

test('findLocallyChangedWorkflows: detect 1 locally changed workflow', async (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-z');

  const workspace = {
    activeProject: {
      forked_from: {
        a: wf1.getVersionHash(),
        b: wf2.getVersionHash(),
      },
    },
  } as any;

  const project = new Project({
    name: 'test',
    workflows: [wf1, wf2],
  });

  project.workflows[0].name = 'changed';

  const changed = await findLocallyChangedWorkflows(workspace, project);
  t.deepEqual(changed, ['a']);
});

test('findLocallyChangedWorkflows: detect 1 locally added workflow', async (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');

  const workspace = {
    activeProject: {
      forked_from: {
        a: wf1.getVersionHash(),
      },
    },
  } as any;

  const project = new Project({
    name: 'test',
    workflows: [wf1, wf2],
  });

  const changed = await findLocallyChangedWorkflows(workspace, project);
  t.deepEqual(changed, ['b']);
});

test('findLocallyChangedWorkflows: detect 1 locally removed workflow', async (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');

  const workspace = {
    activeProject: {
      forked_from: {
        a: wf1.getVersionHash(),
        b: wf2.getVersionHash(),
      },
    },
  } as any;

  const project = new Project({
    name: 'test',
    workflows: [wf1],
  });

  const changed = await findLocallyChangedWorkflows(workspace, project);
  t.deepEqual(changed, ['b']);
});
