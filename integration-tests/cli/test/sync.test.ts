// Tests the new v2 sync API: fetch, pull, checkout and deploy. Uses mock Lightning and asserting on what
// lands on disk (.projects state, checkout.yaml, workflows folder).

import test from 'ava';
import path from 'node:path';
import fs from 'node:fs';
import run from '../src/run';
import { generateProject } from '@openfn/project';
import createLightningServer from '@openfn/lightning-mock';
import { rimraf } from 'rimraf';

let PORT = 5353;
let lightning;
const endpoint = `http://localhost:${PORT}/api/provision`;

test.before(async () => {
  await rimraf('tmp/sync');

  lightning = createLightningServer({
    port: PORT,
  });
});

const initWorkspace = (t: any) => {
  const id = t.title.replaceAll(' ', '_').toLowerCase();
  const p = path.resolve('tmp/sync', id);

  return {
    workspace: p,
    read: (filePath: string) => {
      return fs.readFileSync(path.resolve(p, filePath), 'utf8');
    },
  };
};

const gen = (
  name = 'patients',
  workflows = ['trigger-job(expression="fn()")']
) => {
  // generate a project
  const project = generateProject(name, workflows, {
    openfnUuid: true,
  });
  const state = project.serialize('state', { format: 'json' });
  lightning.addProject(state);
  return project;
};

test('fetch a new project', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const project = gen();

  const { stdout } = await run(
    `openfn project fetch \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       ${project.openfn.uuid}`
  );

  // now check that the filesystem is roughly right
  const pyaml = read('.projects/main@localhost.yaml');

  t.regex(pyaml, /id: patients/);
  t.regex(pyaml, new RegExp(`uuid: ${project.openfn.uuid}`));
});

test('fetch a new project with an alias', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const project = gen();

  await run(
    `openfn project fetch \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --alias staging\
       ${project.openfn.uuid}`
  );

  // now check that the filesystem is roughly right
  const pyaml = read('.projects/staging@localhost.yaml');

  t.regex(pyaml, /id: patients/);
  t.regex(pyaml, new RegExp(`uuid: ${project.openfn.uuid}`));
});

test('fetch a new project to a path', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const project = gen();

  await run(
    `openfn project fetch \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --output ${workspace}/project.yaml\
       ${project.openfn.uuid}`
  );

  // now check that the filesystem is roughly right
  const pyaml = read('project.yaml');

  t.regex(pyaml, /id: patients/);
  t.regex(pyaml, new RegExp(`uuid: ${project.openfn.uuid}`));
});

test.todo('fetch throws if writing a new project UUID to an existing file');

test('fetch an existing project with an alias', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const project = gen();

  // fetch the project locally
  await run(
    `openfn project fetch \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --alias staging \
       ${project.openfn.uuid}`
  );

  const before = read('.projects/staging@localhost.yaml');
  t.regex(before, /fn\(\)/);

  // now update the remote project
  project.workflows[0].steps[0].expression = 'fn(x)';
  const state = project.serialize('state', { format: 'json' });
  lightning.addProject(state);

  // Now run another fetch but only use the alias - no uuid
  await run(
    `openfn project fetch \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       staging`
  );

  // now check that the filesystem is roughly right
  const after = read('.projects/staging@localhost.yaml');

  t.regex(after, /fn\(x\)/);
});

test('pull a new project', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const project = gen();

  await run(
    `openfn project pull \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --log debug \
       ${project.openfn.uuid}`
  );

  // now check that the filesystem is roughly right
  const proj_yaml = read('.projects/main@localhost.yaml');

  t.regex(proj_yaml, /id: patients/);
  t.regex(proj_yaml, new RegExp(`uuid: ${project.openfn.uuid}`));

  const checkout_yaml = read('.openfn/checkout.yaml');
  t.regex(checkout_yaml, new RegExp(`uuid: ${project.openfn.uuid}`));
  t.regex(checkout_yaml, new RegExp(`endpoint: ${endpoint}`));

  const job = read('workflows/workflow/job.js');
  t.is(job, 'fn()');
});

test('pull a new project with an alias', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const project = gen();

  await run(
    `openfn project pull \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --log debug \
       --alias staging \
       ${project.openfn.uuid}`
  );

  // now check that the filesystem is roughly right
  const proj_yaml = read('.projects/staging@localhost.yaml');

  t.regex(proj_yaml, /id: patients/);
  t.regex(proj_yaml, new RegExp(`uuid: ${project.openfn.uuid}`));

  const checkout_yaml = read('.openfn/checkout.yaml');
  t.regex(checkout_yaml, new RegExp(`uuid: ${project.openfn.uuid}`));
  t.regex(checkout_yaml, new RegExp(`endpoint: ${endpoint}`));

  const job = read('workflows/workflow/job.js');
  t.is(job, 'fn()');
});

test('pull an update to project', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const project = gen();

  // fetch the project once to set up the repo
  await run(
    `openfn project pull \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       ${project.openfn.uuid}`
  );

  const job = read('workflows/workflow/job.js');
  t.is(job, 'fn()');

  // now update the remote project
  project.workflows[0].steps[0].expression = 'fn(x)';
  const state = project.serialize('state', { format: 'json' });
  lightning.addProject(state);
  // (note that the verison hash hasn't updated so not the best test)

  // and refetch
  await run(
    `openfn project pull \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       ${project.openfn.uuid}`
  );

  const proj_yaml = read('.projects/main@localhost.yaml');
  t.regex(proj_yaml, /fn\(x\)/);
  t.regex(proj_yaml, new RegExp(`uuid: ${project.openfn.uuid}`));

  const checkout_yaml = read('.openfn/checkout.yaml');
  t.regex(checkout_yaml, new RegExp(`uuid: ${project.openfn.uuid}`));
  t.regex(checkout_yaml, new RegExp(`endpoint: ${endpoint}`));

  const job_updated = read('workflows/workflow/job.js');
  t.is(job_updated, 'fn()');
});

test('checkout by alias', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const main = gen();
  const staging = gen('patients-staging', ['trigger-job(expression="fn(x)")']);

  await run(
    `openfn project fetch \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --alias main\
       ${main.openfn.uuid}`
  );
  await run(
    `openfn project fetch \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --alias staging\
       ${staging.openfn.uuid}`
  );

  // Ensure the repo is set up correctly
  const main_yaml = read('.projects/main@localhost.yaml');
  t.regex(main_yaml, /fn\(\)/);
  const staging_yaml = read('.projects/staging@localhost.yaml');
  t.regex(staging_yaml, /fn\(x\)/);

  await run(
    `openfn project checkout main \
       --workspace ${workspace}`
  );

  // only do a rough check of the file system
  // local tests can be more thorough - at this level
  // I just want to see that the command has basically worked
  let job = read('workflows/workflow/job.js');
  t.is(job, 'fn()');

  await run(
    `openfn project checkout staging \
       --workspace ${workspace}`
  );

  job = read('workflows/workflow/job.js');
  t.is(job, 'fn(x)');
});

test('pull, edit, deploy, then pull again', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const project = gen();

  await run(
    `openfn project pull \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       ${project.openfn.uuid}`
  );

  fs.writeFileSync(path.join(workspace, 'workflows/workflow/job.js'), 'fn(x)');

  await run(
    `openfn project deploy \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --no-confirm`
  );

  // the server has the edit
  const [workflow] = Object.values(
    lightning.state.projects[project.openfn.uuid].workflows
  ) as any[];
  t.is(Object.values<any>(workflow.jobs)[0].body, 'fn(x)');

  // the deploy updates the checkout, tracking the workflow as it is on disk
  const checkoutAfterDeploy = read('.openfn/checkout.yaml');
  t.regex(checkoutAfterDeploy, /forked_from:\n  workflow: /);
  t.regex(checkoutAfterDeploy, /workflow_uuids:\n  workflow: /);

  await run(
    `openfn project pull \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       ${project.openfn.uuid}`
  );

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
  const { workspace, read } = initWorkspace(t);
  const project = gen();

  await run(
    `openfn project pull \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       ${project.openfn.uuid}`
  );
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
  await run(
    `openfn project fetch \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       ${project.openfn.uuid}`
  );

  // the tracked project has the remote change
  t.regex(read('.projects/main@localhost.yaml'), /fn\(remote\)/);

  // but the workspace is untouched
  t.is(read('workflows/workflow/job.js'), 'fn(local)');
  t.is(read('.openfn/checkout.yaml'), checkoutBefore);
});

test.todo('merge by alias');
