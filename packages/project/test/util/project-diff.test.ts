import test from 'ava';
import { Project } from '../../src/Project';
import { diff } from '../../src/util/project-diff';
import generateWorkflow from '../../src/gen/generator';

test('diff: should return empty array for identical projects', (t) => {
  const wf = generateWorkflow('trigger-x');

  const projectA = new Project({
    name: 'project-a',
    workflows: [wf],
  });

  const projectB = new Project({
    name: 'project-b',
    workflows: [wf],
  });

  const diffs = diff(projectA, projectB);

  t.is(diffs.length, 0);
});

test('diff: should detect changed workflow', (t) => {
  const wfA = generateWorkflow('trigger-x');
  const wfB = generateWorkflow('trigger-y');
  // Make sure they have the same id but different content
  wfB.id = wfA.id;

  const projectA = new Project({
    name: 'project-a',
    workflows: [wfA],
  });

  const projectB = new Project({
    name: 'project-b',
    workflows: [wfB],
  });

  const diffs = diff(projectA, projectB);

  t.is(diffs.length, 1);
  t.deepEqual(diffs[0], { id: wfA.id, type: 'changed' });
});

test('diff: should detect added workflow', (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');

  const from = new Project({
    name: 'from',
    workflows: [wf1],
  });

  const to = new Project({
    name: 'to',
    workflows: [wf1, wf2],
  });

  const diffs = diff(from, to);

  t.is(diffs.length, 1);
  t.deepEqual(diffs[0], { id: wf2.id, type: 'added' });
});

test('diff: should detect removed workflow', (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');

  const from = new Project({
    name: 'from',
    workflows: [wf1, wf2],
  });

  const to = new Project({
    name: 'to',
    workflows: [wf1],
  });

  const diffs = diff(from, to);

  t.is(diffs.length, 1);
  t.deepEqual(diffs[0], { id: wf2.id, type: 'removed' });
});

test('diff: should detect multiple changes at once', (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');
  const wf3 = generateWorkflow('@id c trigger-z');
  const wf4 = generateWorkflow('@id d trigger-w');

  // wf2 will be changed in to
  const wf2Changed = generateWorkflow('@id b trigger-different');

  const from = new Project({
    name: 'from',
    workflows: [wf1, wf2, wf3], // has a, b, c
  });

  const to = new Project({
    name: 'to',
    workflows: [wf1, wf2Changed, wf4], // has a, b (changed), d (new)
  });

  const diffs = diff(from, to);

  t.is(diffs.length, 3);
  t.deepEqual(
    diffs.find((d) => d.id === 'b'),
    { id: 'b', type: 'changed' }
  );
  t.deepEqual(
    diffs.find((d) => d.id === 'c'),
    { id: 'c', type: 'removed' }
  );
  t.deepEqual(
    diffs.find((d) => d.id === 'd'),
    { id: 'd', type: 'added' }
  );
});

test('diff: should detect multiple workflows with same type of change', (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');
  const wf3 = generateWorkflow('@id c trigger-z');

  const wf1Changed = generateWorkflow('@id a trigger-X');
  const wf2Changed = generateWorkflow('@id b trigger-Y');

  const projectA = new Project({
    name: 'project-a',
    workflows: [wf1, wf2, wf3],
  });

  const projectB = new Project({
    name: 'project-b',
    workflows: [wf1Changed, wf2Changed, wf3],
  });

  const diffs = diff(projectA, projectB);

  t.is(diffs.length, 2);
  t.deepEqual(diffs[0], { id: 'a', type: 'changed' });
  t.deepEqual(diffs[1], { id: 'b', type: 'changed' });
});

test('diff: should detect change when workflow has same ID but different name', (t) => {
  const wf1 = generateWorkflow('@id my-workflow trigger-x');
  const wf2 = generateWorkflow('@id my-workflow trigger-y');

  // Ensure they have the same ID but different content
  wf1.name = 'Original Name';
  wf2.name = 'Different Name';

  const projectA = new Project({
    name: 'project-a',
    workflows: [wf1],
  });

  const projectB = new Project({
    name: 'project-b',
    workflows: [wf2],
  });

  const diffs = diff(projectA, projectB);

  t.is(diffs.length, 1);
  t.deepEqual(diffs[0], { id: 'my-workflow', type: 'changed' });
});
