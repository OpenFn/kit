// Deploying a workspace to a different project (eg, updating prod to match a project from
// the cloud, or replicating a project onto another server), against mock Lightnings:
// the target is made to look exactly like the workspace

import test from 'ava';
import { generateProject } from '@openfn/project';
import createLightningServer from '@openfn/lightning-mock';
import { setup } from './helpers';

const { lightning, initWorkspace, gen } = setup(test, 'cross-project', 5357);

// a second server, for deploying across servers
const OTHER_PORT = 5358;
const otherEndpoint = `http://localhost:${OTHER_PORT}/api/provision`;
const other: any = createLightningServer({ port: OTHER_PORT });

// a project's workflows on a server, as { name: code }
const code = (server: any, project: any) =>
  Object.fromEntries(
    (
      Object.values(
        server.state.projects[project.openfn.uuid].workflows
      ) as any[]
    ).map((wf) => [
      wf.name,
      Object.values<any>(wf.jobs).find((j) => j.body).body,
    ])
  );

// a project's workflows on a server, as { name: uuid }
const uuids = (server: any, project: any) =>
  Object.fromEntries(
    (
      Object.values(
        server.state.projects[project.openfn.uuid].workflows
      ) as any[]
    ).map((wf) => [wf.name, wf.id])
  );

// The workspace is pulled from cloud (Alpha and Beta). Prod has its own version of
// Alpha, and a workflow of its own (Gamma)
const genProjects = () => ({
  cloud: gen('cloud', [
    '@name Alpha trigger-job(expression="fn(a)")',
    '@name Beta trigger-job(expression="fn(b)")',
  ]),
  prod: gen('prod', [
    '@name Alpha trigger-job(expression="fn(old)")',
    '@name Gamma trigger-job(expression="fn(g)")',
  ]),
});

test('deploy to a different project to make it match the workspace', async (t) => {
  const { read, run } = initWorkspace(t);
  const { cloud, prod } = genProjects();
  const prodAlpha = uuids(lightning, prod).Alpha;

  await run(`openfn project pull ${cloud.openfn.uuid}`);

  const { stdout } = await run(
    `openfn project deploy ${prod.openfn.uuid} --force`
  );
  t.regex(stdout, /Gamma: deleted/);
  t.regex(stdout, /Alpha: changed/);
  t.regex(stdout, /Beta: added/);

  // prod has exactly the workspace's workflows, and none of its own
  t.deepEqual(code(lightning, prod), { Alpha: 'fn(a)', Beta: 'fn(b)' });

  // its existing workflow was updated in place (it keeps its own uuid)
  t.is(uuids(lightning, prod).Alpha, prodAlpha);

  // and cloud is untouched
  t.deepEqual(code(lightning, cloud), { Alpha: 'fn(a)', Beta: 'fn(b)' });
  t.regex(read('workflows/alpha/alpha.yaml'), /name: Alpha/);
});

test('workflows deployed to a different project get new uuids', async (t) => {
  const { run } = initWorkspace(t);
  const { cloud, prod } = genProjects();

  await run(`openfn project pull ${cloud.openfn.uuid}`);
  await run(`openfn project deploy ${prod.openfn.uuid} --force`);

  const prodUuids = uuids(lightning, prod);
  const cloudUuids = uuids(lightning, cloud);

  // Ensure prod's workflows have their own UUIDs
  t.truthy(prodUuids.Alpha);
  t.truthy(prodUuids.Beta);
  t.not(prodUuids.Beta, cloudUuids.Beta);
  t.not(prodUuids.Alpha, cloudUuids.Alpha);
});

test('deploy to a different project without a prompt will not remove workflows unless forced', async (t) => {
  const { run } = initWorkspace(t);
  const { cloud, prod } = genProjects();

  await run(`openfn project pull ${cloud.openfn.uuid}`);

  // (the test runner never prompts, so this is a deploy with --no-confirm)
  const { stdout, stderr, err } = await run(
    `openfn project deploy ${prod.openfn.uuid}`
  );
  t.truthy(err);
  t.regex(stdout + stderr, /would remove workflows/);
  t.regex(stdout + stderr, /gamma/);

  // prod is untouched
  t.deepEqual(code(lightning, prod), { Alpha: 'fn(old)', Gamma: 'fn(g)' });
});

test('a dry run to a different project shows what would change, and changes nothing', async (t) => {
  const { run } = initWorkspace(t);
  const cloud = gen('cloud', [
    '@name Alpha trigger-job(expression="fn(a)")',
    '@name Beta trigger-job(expression="fn(b)")',
  ]);
  // a project with only a workflow of its own, which the deploy would remove
  const prod = gen('prod', ['@name Gamma trigger-job(expression="fn(g)")']);

  await run(`openfn project pull ${cloud.openfn.uuid}`);

  // (without --force: a dry run isn't blocked by the removal guard)
  const { stdout, err } = await run(
    `openfn project deploy ${prod.openfn.uuid} --dry-run`
  );
  t.falsy(err);
  t.regex(stdout, /Gamma: deleted/);
  t.regex(stdout, /Alpha: added/);
  t.regex(stdout, /Beta: added/);
  t.regex(stdout, /dryRun option set/);

  t.deepEqual(code(lightning, prod), { Gamma: 'fn(g)' });
});

test('deploy to a different project that was edited elsewhere needs --force', async (t) => {
  const { run } = initWorkspace(t);
  const cloud = gen('cloud', [
    '@name Alpha trigger-job(expression="fn(a)")',
    '@name Beta trigger-job(expression="fn(b)")',
  ]);
  // the same workflows, with different code (so no workflows are removed)
  const prod = gen('prod', [
    '@name Alpha trigger-job(expression="fn(old-a)")',
    '@name Beta trigger-job(expression="fn(old-b)")',
  ]);

  await run(`openfn project pull ${cloud.openfn.uuid}`);

  const { stdout, stderr, err } = await run(
    `openfn project deploy ${prod.openfn.uuid}`
  );
  t.truthy(err);
  t.regex(stdout + stderr, /not the project this workspace was synced from/);
  t.deepEqual(code(lightning, prod), {
    Alpha: 'fn(old-a)',
    Beta: 'fn(old-b)',
  });

  await run(`openfn project deploy ${prod.openfn.uuid} --force`);
  t.deepEqual(code(lightning, prod), { Alpha: 'fn(a)', Beta: 'fn(b)' });
});

test('deploy to a different project by its local alias', async (t) => {
  const { run } = initWorkspace(t);
  const { cloud, prod } = genProjects();

  await run(`openfn project pull ${cloud.openfn.uuid}`);
  await run(`openfn project fetch --alias prod ${prod.openfn.uuid}`);

  await run('openfn project deploy prod --force');

  t.deepEqual(code(lightning, prod), { Alpha: 'fn(a)', Beta: 'fn(b)' });
  t.deepEqual(code(lightning, cloud), { Alpha: 'fn(a)', Beta: 'fn(b)' });
});

test('deploy a project yaml file to a different project', async (t) => {
  const { workspace, run } = initWorkspace(t);
  const { cloud, prod } = genProjects();

  // save cloud to a file, rather than expanding it into a workspace
  await run(
    `openfn project fetch --output ${workspace}/cloud.yaml ${cloud.openfn.uuid}`
  );

  const { stdout } = await run(
    `openfn project deploy cloud.yaml ${prod.openfn.uuid} --force`
  );
  t.regex(stdout, /Gamma: deleted/);
  t.regex(stdout, /Alpha: changed/);
  t.regex(stdout, /Beta: added/);

  // prod matches the file, and cloud is untouched
  t.deepEqual(code(lightning, prod), { Alpha: 'fn(a)', Beta: 'fn(b)' });
  t.deepEqual(code(lightning, cloud), { Alpha: 'fn(a)', Beta: 'fn(b)' });
});

test('deploy a workspace to a project on a different server', async (t) => {
  const { run } = initWorkspace(t);
  const cloud = gen('cloud', [
    '@name Alpha trigger-job(expression="fn(a)")',
    '@name Beta trigger-job(expression="fn(b)")',
  ]);

  // a replica of cloud, on another server, with older code
  const replica = generateProject(
    'replica',
    ['@name Alpha trigger-job(expression="fn(old)")'],
    { openfnUuid: true }
  );
  other.addProject(replica.serialize('state', { format: 'json' }));

  await run(`openfn project pull ${cloud.openfn.uuid}`);
  await run(
    `openfn project deploy ${replica.openfn.uuid} --endpoint ${otherEndpoint} --force`
  );

  // the replica matches the workspace, and cloud is untouched
  t.deepEqual(code(other, replica), { Alpha: 'fn(a)', Beta: 'fn(b)' });
  t.deepEqual(code(lightning, cloud), { Alpha: 'fn(a)', Beta: 'fn(b)' });
});

test.todo(
  'after deploying to a different project, the workspace still deploys to the project it came from'
);
