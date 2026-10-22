// Sync round trips (pull, edit, deploy, pull again) against a mock Lightning,
// checking that the workspace and the remote project stay consistent

import test from 'ava';
import path from 'node:path';
import fs from 'node:fs';
import { setup } from './helpers';

const { lightning, initWorkspace, gen } = setup(test, 'roundtrip', 5354);

test('pull, edit, deploy, then pull again', async (t) => {
  const { workspace, read, run } = initWorkspace(t);
  const project = gen();

  await run(`openfn project pull ${project.openfn.uuid}`);

  fs.writeFileSync(path.join(workspace, 'workflows/workflow/job.js'), 'fn(x)');

  await run('openfn project deploy');

  // the server has the edit
  const [workflow] = Object.values(
    lightning.state.projects[project.openfn.uuid].workflows
  ) as any[];
  t.is(Object.values<any>(workflow.jobs)[0].body, 'fn(x)');

  // the deploy updates the checkout, tracking the workflow as it is on disk
  const checkoutAfterDeploy = read('.openfn/checkout.yaml');
  t.regex(checkoutAfterDeploy, /forked_from:\n  workflow: /);
  t.regex(checkoutAfterDeploy, /workflow_uuids:\n  workflow: /);

  await run(`openfn project pull ${project.openfn.uuid}`);

  // pulling what we just deployed changes nothing
  t.is(read('workflows/workflow/job.js'), 'fn(x)');
  t.deepEqual(fs.readdirSync(path.join(workspace, 'workflows')), ['workflow']);
  t.deepEqual(
    fs.readdirSync(path.join(workspace, 'workflows/workflow')).sort(),
    ['job.js', 'workflow.yaml']
  );
  t.is(read('.openfn/checkout.yaml'), checkoutAfterDeploy);
});

test('fetch only updates the tracked project', async (t) => {
  const { workspace, read, run } = initWorkspace(t);
  const project = gen();

  await run(`openfn project pull ${project.openfn.uuid}`);
  const checkoutBefore = read('.openfn/checkout.yaml');

  // Make a local change
  fs.writeFileSync(
    path.join(workspace, 'workflows/workflow/job.js'),
    'fn(local)'
  );

  // And a contrasting remote change
  project.workflows[0].steps[0].expression = 'fn(remote)';
  lightning.addProject(project.serialize('state', { format: 'json' }));

  // Now fetch
  await run(`openfn project fetch ${project.openfn.uuid}`);

  // the tracked project has the remote change
  t.regex(read('.projects/main@localhost.yaml'), /fn\(remote\)/);

  // but the workspace is untouched
  t.is(read('workflows/workflow/job.js'), 'fn(local)');
  t.is(read('.openfn/checkout.yaml'), checkoutBefore);
});
