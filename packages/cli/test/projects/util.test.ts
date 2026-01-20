import test from 'ava';
import Project, { generateWorkflow } from '@openfn/project';
import { tidyWorkflowDir } from '../../src/projects/util';

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
