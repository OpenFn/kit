import test from 'ava';
import Project from '../src';
import { merge, MergeProjectOptions } from '../src/merge/merge-project';
import { generateWorkflow } from '../src/gen/generator';

/**
 * These tests simulate what `openfn project deploy` actually does when it
 * calls Project.merge()
 *
 * TODO we should actually import this straight from CLI. Is the dev dependency a problem?
 * Or should we move the decision into this package?
 */
const buildDeployMergeOptions = (
  local: Project,
  remote: Project,
  workflows?: string[]
): MergeProjectOptions => {
  const mergeOptions: MergeProjectOptions = {
    /**
     * If pushing a local project to its tracked remote, ie an update,
     * use the replace-merge strategy
     *
     * If pushing a project to a different remote, use the sandbox-merge strategy
     */
    mode: local.uuid === remote.uuid ? 'replace' : 'sandbox',
    force: true,
  };

  if (workflows?.length) {
    // Deploy only a subset of workflows. A named workflow that no longer
    // exists locally (but does exist on the remote) is a deletion request.
    const deleted = workflows.filter(
      (id) => !local.workflows.some((w) => w.id === id)
    );
    mergeOptions.workflowMappings = Object.fromEntries(
      workflows.filter((id) => !deleted.includes(id)).map((id) => [id, id])
    );
    mergeOptions.removeIds = deleted;
  } else {
    // deploy everything (but only changed), and make the remote match the
    // local project exactly
    mergeOptions.onlyUpdated = true;
    mergeOptions.removeUnmapped = true;
  }

  return mergeOptions;
};

const createProject = (workflows: any[], uuid: string) =>
  new Project({
    id: 'my-project',
    name: 'My Project',
    workflows,
    openfn: { uuid },
  });

test('deploy: a workflow removed locally is removed from the remote', (t) => {
  const remote = createProject(
    [
      generateWorkflow('@id a a-1', { uuidSeed: 100, history: true }),
      generateWorkflow('@id b b-1', { uuidSeed: 200, history: true }),
    ],
    'same-project'
  );

  // local only has 'a' - 'b' was deleted from the project file
  const local = createProject(
    [generateWorkflow('@id a a-1', { uuidSeed: 100, history: true })],
    'same-project'
  );
  local.cli.forked_from = {
    a: local.workflows[0].getVersionHash(),
    b: remote.workflows[1].getVersionHash(),
  };

  const merged = merge(local, remote, buildDeployMergeOptions(local, remote));

  t.deepEqual(merged.workflows.map((w) => w.id).sort(), ['a']);
});

test('deploy: nothing is removed when nothing has changed', (t) => {
  const build = () => [
    generateWorkflow('@id a a-1', { uuidSeed: 100, history: true }),
    generateWorkflow('@id b b-1', { uuidSeed: 200, history: true }),
  ];
  const remote = createProject(build(), 'same-project');
  const local = createProject(build(), 'same-project');

  const merged = merge(local, remote, buildDeployMergeOptions(local, remote));

  t.deepEqual(merged.workflows.map((w) => w.id).sort(), ['a', 'b']);
});

test('deploy: a changed workflow is updated, an untouched one is left alone', (t) => {
  const build = () => [
    generateWorkflow('@id a a-1', { uuidSeed: 100, history: true }),
    generateWorkflow('@id b b-1', { uuidSeed: 200, history: true }),
  ];
  const remote = createProject(build(), 'same-project');
  const local = createProject(build(), 'same-project');

  // mark the remote's copy of 'b' so we can prove it survives untouched
  (local.workflows[0] as any).jam = 'jar';
  local.workflows[1].steps[0].expression = 'fn()';

  const merged = merge(local, remote, buildDeployMergeOptions(local, remote));

  t.is(merged.getWorkflow('b')?.steps[0].expression, 'fn()');
  // 'a' was untouched locally, so the remote's own copy (without our scribble) survives
  t.falsy((merged.getWorkflow('a') as any)?.jam);
});

test('deploy --workflow a: a locally-deleted "b" is left alone on the remote', (t) => {
  const remote = createProject(
    [
      generateWorkflow('@id a a-1', { uuidSeed: 100, history: true }),
      generateWorkflow('@id b b-1', { uuidSeed: 200, history: true }),
    ],
    'same-project'
  );

  // 'b' doesn't exist locally at all, but we're only deploying 'a'
  const local = createProject(
    [generateWorkflow('@id a a-2', { uuidSeed: 100, history: true })],
    'same-project'
  );

  const merged = merge(
    local,
    remote,
    buildDeployMergeOptions(local, remote, ['a'])
  );

  // 'b' was never in scope for this deploy, so it must survive
  t.deepEqual(merged.workflows.map((w) => w.id).sort(), ['a', 'b']);
});

test('deploy --workflow b: an explicitly named, locally-deleted workflow is removed, others are untouched', (t) => {
  const remote = createProject(
    [
      generateWorkflow('@id a a-1', { uuidSeed: 100, history: true }),
      generateWorkflow('@id b b-1', { uuidSeed: 200, history: true }),
      generateWorkflow('@id c c-1', { uuidSeed: 300, history: true }),
    ],
    'same-project'
  );

  // 'b' was deleted locally; 'c' was never touched and isn't named at all
  const local = createProject(
    [generateWorkflow('@id a a-1', { uuidSeed: 100, history: true })],
    'same-project'
  );

  const merged = merge(
    local,
    remote,
    buildDeployMergeOptions(local, remote, ['b'])
  );

  t.deepEqual(merged.workflows.map((w) => w.id).sort(), ['a', 'c']);
});

test('deploy: a brand new project (different uuid) keeps everything from both sides', (t) => {
  const remote = createProject(
    [generateWorkflow('@id a a-1', { uuidSeed: 100, history: true })],
    'remote-project'
  );

  const local = createProject(
    [
      generateWorkflow('@id a a-1', { uuidSeed: 100, history: true }),
      generateWorkflow('@id c c-1', { uuidSeed: 300, history: true }),
    ],
    'local-project'
  );

  const merged = merge(local, remote, buildDeployMergeOptions(local, remote));

  t.deepEqual(merged.workflows.map((w) => w.id).sort(), ['a', 'c']);
});
