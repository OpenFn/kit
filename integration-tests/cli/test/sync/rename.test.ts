// Renaming workflows locally, alone and combined with other edits, then deploying to a mock
// Lightning: the workflow must keep its uuid, and the checkout files must track its local id

import test from 'ava';
import path from 'node:path';
import fs from 'node:fs';
import run from '../../src/run';
import { setup } from './helpers';

const { lightning, endpoint, initWorkspace, gen } = setup(test, 'rename', 5356);

test('rename a workflow and deploy', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const project = gen();
  const wfPath = path.join(workspace, 'workflows/workflow/workflow.yaml');

  await run(
    `openfn project pull \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       ${project.openfn.uuid}`
  );

  const [before] = Object.values(
    lightning.state.projects[project.openfn.uuid].workflows
  ) as any[];
  const jobIds = Object.values<any>(before.jobs).map((j) => j.id);
  const triggerIds = Object.values<any>(before.triggers).map((j) => j.id);
  const edgeIds = Object.values<any>(before.edges).map((j) => j.id);

  fs.writeFileSync(
    wfPath,
    read('workflows/workflow/workflow.yaml').replace(
      'name: Workflow',
      'name: Renamed'
    )
  );

  await run(
    `openfn project deploy \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --no-confirm`
  );

  // the server has the same workflow and steps (by uuid), with the new name
  const workflows = Object.values(
    lightning.state.projects[project.openfn.uuid].workflows
  ) as any[];
  t.is(workflows.length, 1);
  t.is(workflows[0].id, before.id);
  t.is(workflows[0].name, 'Renamed');
  t.deepEqual(
    Object.values<any>(workflows[0].jobs).map((j) => j.id),
    jobIds
  );
  t.deepEqual(
    Object.values<any>(workflows[0].triggers).map((j) => j.id),
    triggerIds
  );
  t.deepEqual(
    Object.values<any>(workflows[0].edges).map((j) => j.id),
    edgeIds
  );

  // the workflow stays where it was, under the id it had locally
  t.regex(read('workflows/workflow/workflow.yaml'), /name: Renamed/);
  t.false(fs.existsSync(path.join(workspace, 'workflows/renamed')));

  // and the checkout file tracks it by that local id
  const checkout = read('.openfn/checkout.yaml');
  t.regex(checkout, /forked_from:\n  workflow: /);
  t.regex(checkout, new RegExp(`workflow_uuids:\n  workflow: ${before.id}`));
  t.notRegex(checkout, /renamed/);

  // everything is now in sync, so there is nothing left to deploy
  const { stdout: again } = await run(
    `openfn project deploy \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --no-confirm`
  );
  t.regex(again, /Nothing to deploy/);
});

test('rename a workflow, deploy, then edit and deploy again', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const project = gen();
  const wfPath = path.join(workspace, 'workflows/workflow/workflow.yaml');

  await run(
    `openfn project pull \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       ${project.openfn.uuid}`
  );
  const [before] = Object.values(
    lightning.state.projects[project.openfn.uuid].workflows
  ) as any[];

  fs.writeFileSync(
    wfPath,
    read('workflows/workflow/workflow.yaml').replace(
      'name: Workflow',
      'name: Renamed'
    )
  );
  await run(
    `openfn project deploy \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --no-confirm`
  );

  // now change the code in the renamed workflow and deploy again
  fs.writeFileSync(path.join(workspace, 'workflows/workflow/job.js'), 'fn(x)');
  const { stdout } = await run(
    `openfn project deploy \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --no-confirm`
  );

  // it's an edit to the workflow, not a new workflow
  t.regex(stdout, /Renamed: changed/);
  t.notRegex(stdout, /: (added|deleted)/);

  // the server workflow was updated in place
  const workflows = Object.values(
    lightning.state.projects[project.openfn.uuid].workflows
  ) as any[];
  t.is(workflows.length, 1);
  t.is(workflows[0].id, before.id);
  t.is(workflows[0].name, 'Renamed');
  t.is(Object.values<any>(workflows[0].jobs)[0].body, 'fn(x)');

  // and the checkout is still tracking the local id
  const checkout = read('.openfn/checkout.yaml');
  t.regex(checkout, /forked_from:\n  workflow: /);
  t.regex(checkout, new RegExp(`workflow_uuids:\n  workflow: ${before.id}`));

  // everything is now in sync, so there is nothing left to deploy
  const { stdout: again } = await run(
    `openfn project deploy \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --no-confirm`
  );
  t.regex(again, /Nothing to deploy/);
});

test('rename and edit a workflow in the same deploy', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const project = gen();
  const wfPath = path.join(workspace, 'workflows/workflow/workflow.yaml');

  await run(
    `openfn project pull \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       ${project.openfn.uuid}`
  );
  const [before] = Object.values(
    lightning.state.projects[project.openfn.uuid].workflows
  ) as any[];

  fs.writeFileSync(
    wfPath,
    read('workflows/workflow/workflow.yaml').replace(
      'name: Workflow',
      'name: Renamed'
    )
  );
  fs.writeFileSync(path.join(workspace, 'workflows/workflow/job.js'), 'fn(x)');

  const { stdout } = await run(
    `openfn project deploy \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --no-confirm`
  );
  t.regex(stdout, /Renamed: changed/);
  t.notRegex(stdout, /: (added|deleted)/);

  const workflows = Object.values(
    lightning.state.projects[project.openfn.uuid].workflows
  ) as any[];
  t.is(workflows.length, 1);
  t.is(workflows[0].id, before.id);
  t.is(workflows[0].name, 'Renamed');
  t.is(Object.values<any>(workflows[0].jobs)[0].body, 'fn(x)');

  const checkout = read('.openfn/checkout.yaml');
  t.regex(checkout, new RegExp(`workflow_uuids:\n  workflow: ${before.id}`));

  // everything is now in sync, so there is nothing left to deploy
  const { stdout: again } = await run(
    `openfn project deploy \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --no-confirm`
  );
  t.regex(again, /Nothing to deploy/);
});

test('rename two workflows, edit each, and deploy', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const project = gen('patients', [
    '@name Alpha trigger-job(expression="fn()")',
    '@name Beta trigger-job(expression="fn()")',
  ]);

  await run(
    `openfn project pull \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       ${project.openfn.uuid}`
  );
  const uuids: Record<string, string> = {};
  for (const wf of Object.values(
    lightning.state.projects[project.openfn.uuid].workflows
  ) as any[]) {
    uuids[wf.name] = wf.id;
  }

  for (const [id, name] of [
    ['alpha', 'Alpha'],
    ['beta', 'Beta'],
  ]) {
    const wfPath = path.join(workspace, `workflows/${id}/${id}.yaml`);
    fs.writeFileSync(
      wfPath,
      read(`workflows/${id}/${id}.yaml`).replace(
        `name: ${name}`,
        `name: ${name} 2`
      )
    );
    fs.writeFileSync(
      path.join(workspace, `workflows/${id}/job.js`),
      `fn(${id})`
    );
  }

  await run(
    `openfn project deploy \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --no-confirm`
  );

  // each workflow keeps its own uuid, with its own new name and code
  const workflows = Object.values(
    lightning.state.projects[project.openfn.uuid].workflows
  ) as any[];
  t.is(workflows.length, 2);
  const alpha = workflows.find((w) => w.name === 'Alpha 2');
  const beta = workflows.find((w) => w.name === 'Beta 2');
  t.is(alpha.id, uuids.Alpha);
  t.is(beta.id, uuids.Beta);
  t.is(Object.values<any>(alpha.jobs)[0].body, 'fn(alpha)');
  t.is(Object.values<any>(beta.jobs)[0].body, 'fn(beta)');

  // the checkout tracks both by their local ids
  const checkout = read('.openfn/checkout.yaml');
  t.regex(
    checkout,
    new RegExp(
      `workflow_uuids:\n  alpha: ${uuids.Alpha}\n  beta: ${uuids.Beta}`
    )
  );

  // everything is now in sync, so there is nothing left to deploy
  const { stdout: again } = await run(
    `openfn project deploy \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --no-confirm`
  );
  t.regex(again, /Nothing to deploy/);
});

test('remove one workflow and rename another in the same deploy', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const project = gen('patients', [
    '@name Alpha trigger-job(expression="fn()")',
    '@name Beta trigger-job(expression="fn()")',
  ]);

  await run(
    `openfn project pull \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       ${project.openfn.uuid}`
  );
  const alphaBefore = (
    Object.values(
      lightning.state.projects[project.openfn.uuid].workflows
    ) as any[]
  ).find((w) => w.name === 'Alpha');

  fs.rmSync(path.join(workspace, 'workflows/beta'), { recursive: true });
  fs.writeFileSync(
    path.join(workspace, 'workflows/alpha/alpha.yaml'),
    read('workflows/alpha/alpha.yaml').replace('name: Alpha', 'name: Alpha 2')
  );

  const { stdout } = await run(
    `openfn project deploy \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --no-confirm`
  );
  t.regex(stdout, /Beta: deleted/);
  t.regex(stdout, /Alpha 2: changed/);

  // one workflow is left, with the same uuid and its new name
  const workflows = Object.values(
    lightning.state.projects[project.openfn.uuid].workflows
  ) as any[];
  t.is(workflows.length, 1);
  t.is(workflows[0].id, alphaBefore.id);
  t.is(workflows[0].name, 'Alpha 2');

  // the checkout tracks only the survivor, by its local id
  const checkout = read('.openfn/checkout.yaml');
  t.regex(
    checkout,
    new RegExp(`workflow_uuids:\n  alpha: ${alphaBefore.id}\n`)
  );
  t.notRegex(checkout, /beta/);

  // everything is now in sync, so there is nothing left to deploy
  const { stdout: again } = await run(
    `openfn project deploy \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --no-confirm`
  );
  t.regex(again, /Nothing to deploy/);
});
