// Adding, removing and editing workflows locally, then deploying them to a mock Lightning,
// checking both the remote project and the checkout files

import test from 'ava';
import path from 'node:path';
import fs from 'node:fs';
import { setup } from './helpers';

const { lightning, initWorkspace, gen } = setup(test, 'edit', 5355);

test('add a workflow and deploy', async (t) => {
  const { workspace, read, run } = initWorkspace(t);
  const project = gen('patients', [
    '@name Alpha trigger-job(expression="fn()")',
  ]);

  await run(`openfn project pull ${project.openfn.uuid}`);
  const [alphaBefore] = Object.values(
    lightning.state.projects[project.openfn.uuid].workflows
  ) as any[];

  // add a workflow, using the existing one as a starting point
  fs.mkdirSync(path.join(workspace, 'workflows/beta'));
  fs.writeFileSync(
    path.join(workspace, 'workflows/beta/beta.yaml'),
    read('workflows/alpha/alpha.yaml')
      .replace('id: alpha', 'id: beta')
      .replace('name: Alpha', 'name: Beta')
  );
  fs.writeFileSync(path.join(workspace, 'workflows/beta/job.js'), 'fn(beta)');

  const { stdout } = await run('openfn project deploy');
  t.regex(stdout, /Beta: added/);

  // the server has both workflows: the existing one is untouched, the new one has a uuid
  const workflows = Object.values(
    lightning.state.projects[project.openfn.uuid].workflows
  ) as any[];
  t.is(workflows.length, 2);
  const alpha = workflows.find((w) => w.name === 'Alpha');
  const beta = workflows.find((w) => w.name === 'Beta');
  t.is(alpha.id, alphaBefore.id);
  t.truthy(beta.id);
  t.not(beta.id, alpha.id);
  t.is(Object.values<any>(beta.jobs)[0].body, 'fn(beta)');

  // the checkout now tracks the new workflow, by the local id it was added with
  const checkout = read('.openfn/checkout.yaml');
  t.regex(
    checkout,
    new RegExp(`workflow_uuids:\n  alpha: ${alpha.id}\n  beta: ${beta.id}`)
  );

  // everything is now in sync, so there is nothing left to deploy
  const { stdout: again } = await run('openfn project deploy');
  t.regex(again, /Nothing to deploy/);
});

test('remove a workflow and deploy', async (t) => {
  const { workspace, read, run } = initWorkspace(t);
  const project = gen('patients', [
    '@name Alpha trigger-job(expression="fn()")',
    '@name Beta trigger-job(expression="fn()")',
  ]);

  await run(`openfn project pull ${project.openfn.uuid}`);
  const alphaBefore = (
    Object.values(
      lightning.state.projects[project.openfn.uuid].workflows
    ) as any[]
  ).find((w) => w.name === 'Alpha');

  fs.rmSync(path.join(workspace, 'workflows/beta'), { recursive: true });

  const { stdout } = await run('openfn project deploy');
  t.regex(stdout, /Beta: deleted/);

  // the workflow is gone from the server, and the other is untouched
  const workflows = Object.values(
    lightning.state.projects[project.openfn.uuid].workflows
  ) as any[];
  t.is(workflows.length, 1);
  t.is(workflows[0].id, alphaBefore.id);
  t.is(workflows[0].name, 'Alpha');

  // and it's no longer tracked locally
  const checkout = read('.openfn/checkout.yaml');
  t.regex(
    checkout,
    new RegExp(`workflow_uuids:\n  alpha: ${alphaBefore.id}\n`)
  );
  t.notRegex(checkout, /beta/);

  // everything is now in sync, so there is nothing left to deploy
  const { stdout: again } = await run('openfn project deploy');
  t.regex(again, /Nothing to deploy/);
});
