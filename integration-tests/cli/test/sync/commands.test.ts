// The v2 sync commands (fetch, pull and checkout) against a mock Lightning,
// asserting on what lands on disk (.projects state, checkout.yaml, workflows folder)

import test from 'ava';
import fs from 'node:fs';
import path from 'node:path';
import run from '../../src/run';
import { setup } from './helpers';

const { lightning, endpoint, initWorkspace, gen } = setup(
  test,
  'commands',
  5353
);

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

test.todo('merge by alias');

test('pull a sandbox by UUID, reusing the local alias if there is one', async (t) => {
  const { workspace, read } = initWorkspace(t);
  const project = gen();

  // make the remote project a sandbox
  lightning.state.projects[project.openfn.uuid].parent_id =
    '6a8a6c6e-5c1d-4b0e-8d52-0d4c4f2f9a11';

  await run(
    `openfn project pull \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --alias staging \
       ${project.openfn.uuid}`
  );
  t.truthy(read('.projects/staging@localhost.yaml'));

  // pull again with no alias. The existing alias should be re-used
  // rather than defaulting to the sandbox id
  await run(
    `openfn project pull \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       ${project.openfn.uuid}`
  );

  t.deepEqual(fs.readdirSync(path.resolve(workspace, '.projects')), [
    'staging@localhost.yaml',
  ]);
  t.regex(read('.openfn/checkout.yaml'), new RegExp(project.openfn.uuid));
});
