import test from 'ava';
import Project from '../../src';
import relabelWorkflows from '../../src/util/relabel-workflows';

const createProject = () =>
  new Project({
    id: 'p',
    workflows: [
      {
        id: 'wf-a',
        name: 'A',
        steps: [{ id: 'step', expression: 'fn(s => s)' }],
        history: ['abcd'],
        openfn: { uuid: 'uuid-a' },
      },
      { id: 'wf-b', name: 'B', steps: [], openfn: { uuid: 'uuid-b' } },
    ],
  } as any);

test('give a workflow a new id, keeping everything else', (t) => {
  const result = relabelWorkflows(createProject(), { 'wf-a': 'renamed' });

  t.deepEqual(
    result.workflows.map((w) => w.id),
    ['renamed', 'wf-b']
  );
  const wf = result.getWorkflow('renamed')!;
  t.is(wf.name, 'A');
  t.is(wf.openfn?.uuid, 'uuid-a');
  t.deepEqual(wf.history, ['abcd']);
  t.is(wf.steps[0].expression, 'fn(s => s)');
});

test('does not mutate the original project', (t) => {
  const project = createProject();
  relabelWorkflows(project, { 'wf-a': 'renamed' });

  t.truthy(project.getWorkflow('wf-a'));
  t.falsy(project.getWorkflow('renamed'));
});

test('ids that are not mapped are left alone', (t) => {
  const result = relabelWorkflows(createProject(), { nope: 'x' });
  t.deepEqual(
    result.workflows.map((w) => w.id),
    ['wf-a', 'wf-b']
  );
});

test('does not share cli meta with the original project', (t) => {
  const project = createProject();
  const result = relabelWorkflows(project, { 'wf-a': 'renamed' });
  result.cli.forked_from = { renamed: 'abcd' };

  t.is(project.cli.forked_from, undefined);
});
