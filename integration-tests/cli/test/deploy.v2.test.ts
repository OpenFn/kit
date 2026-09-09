import test from 'ava';
import path from 'node:path';
import fs from 'node:fs/promises';
import run from '../src/run';
import Project, { jsonToYaml, yamlToJson } from '@openfn/project';
import createLightningServer from '@openfn/lightning-mock';
import { extractLogs, assertLog } from '../src/util';
import { rimraf } from 'rimraf';
import { makeProject, makeMultiProject } from './fixtures/projects';

let server: ReturnType<typeof createLightningServer>;

const port = 8968;
const endpoint = `http://localhost:${port}`;

const tmpDir = path.resolve('tmp/deploy-v2');

test.before(async () => {
  server = await createLightningServer({ port });

  process.env.IGNORE_DOT_ENV = 'true';
  process.env.OPENFN_ENDPOINT = endpoint;
  process.env.OPENFN_WORKSPACE = tmpDir;
  process.env.OPENFN_API_KEY = 'test-key';
});

test.beforeEach(async () => {
  await rimraf(tmpDir);
  await fs.mkdir(tmpDir, { recursive: true });
});

test.serial('pull a project', async (t) => {
  const projectId = 'a';
  server.addProject(makeProject(projectId) as any);

  const { stdout, stderr } = await run(
    `openfn project pull ${projectId} --log-json -l debug`
  );
  t.falsy(stderr);

  assertLog(t, extractLogs(stdout), /Checked out project locally/i);

  const yaml = await fs.readFile(path.resolve(tmpDir, 'openfn.yaml'), 'utf8');
  t.regex(yaml, /uuid\: a/);
  t.regex(yaml, /id\: test-project/);
});

test.serial('pull, change and re-deploy', async (t) => {
  const projectId = 'aaaaaaaa';
  server.addProject(makeProject(projectId) as any);

  // pull the project to set up workspace
  const pullResult = await run(
    `openfn project pull ${projectId} --log-json -l debug`
  );
  t.falsy(pullResult.stderr);
  assertLog(t, extractLogs(pullResult.stdout), /Checked out project locally/i);

  const yaml = await fs.readFile(path.resolve(tmpDir, 'openfn.yaml'), 'utf8');
  t.regex(yaml, /id\: test-project/);

  // modify expression to trigger a change
  const exprPath = path.join(tmpDir, 'workflows/my-workflow/my-job.js');
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, deployed: true }))');

  // deploy
  const { stdout, stderr } = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.falsy(stderr);

  assertLog(t, extractLogs(stdout), /Updated project/);

  // validate the change on the server
  const proj = server.state.projects[projectId];
  t.regex(
    proj.workflows['my-workflow-1'].jobs['my-job'].body,
    /deployed\: true/
  );
});

test.serial('pull, change and re-deploy twice', async (t) => {
  const projectId = 'bbbbbbbb';
  server.addProject(makeProject(projectId) as any);

  const exprPath = path.join(tmpDir, 'workflows/my-workflow/my-job.js');

  // pull
  const pullResult = await run(
    `openfn project pull ${projectId} --log-json -l debug`
  );
  t.falsy(pullResult.stderr);

  // first deploy
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, v: 1 }))');
  const first = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.falsy(first.stderr);
  assertLog(t, extractLogs(first.stdout), /Updated project/);

  // validate the change on the server
  let proj = server.state.projects[projectId];
  t.regex(proj.workflows['my-workflow-1'].jobs['my-job'].body, /v\: 1/);

  // second deploy after another update
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, v: 2 }))');
  const { stdout, stderr } = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.falsy(stderr);
  const logs = extractLogs(stdout);
  assertLog(
    t,
    logs,
    /This will make the following changes to the remote project:/
  );
  assertLog(t, logs, /My Workflow: changed/);
  assertLog(t, logs, /My Job:/gm);
  assertLog(t, logs, /- expression: \+1 lines/gm);

  proj = server.state.projects[projectId];
  t.regex(proj.workflows['my-workflow-1'].jobs['my-job'].body, /v\: 2/);
});

test.serial('deploy and pull to check version history', async (t) => {
  const projectId = 'cccccccc';
  server.addProject(makeProject(projectId) as any);

  const exprPath = path.join(tmpDir, 'workflows/my-workflow/my-job.js');

  // pull and modify
  await run(`openfn project pull ${projectId} --log-json -l debug`);
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, v: 1 }))');

  // deploy then pull
  const { stderr } = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.falsy(stderr);
  await run(`openfn project pull ${projectId} --log-json -l debug`);

  // verify version history
  const projectFile = path.join(tmpDir, '.projects', 'main@localhost.yaml');
  const project = await Project.from('path', projectFile);
  const wf = project.workflows.find((w) => w.id === 'my-workflow');
  t.truthy(wf?.history);
  t.is(wf?.history.length, 1);
});

test.serial('deploy then pull, change one workflow, deploy', async (t) => {
  const projectId = 'dddddddd';
  server.addProject(makeMultiProject(projectId) as any);

  // pull multi workflow project
  const pullResult = await run(
    `openfn project pull ${projectId} --log-json -l debug`
  );
  t.falsy(pullResult.stderr);
  assertLog(t, extractLogs(pullResult.stdout), /Checked out project locally/i);

  // modify another-workflow
  const exprPath = path.join(
    tmpDir,
    'workflows/another-workflow/another-job.js'
  );
  await fs.writeFile(exprPath, "post('http://success.org')");

  // deploy
  const { stdout, stderr } = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.falsy(stderr);
  const logs = extractLogs(stdout);
  assertLog(t, logs, /Updated project/);

  // another-workflow should appear in the modified list
  const anotherLog = logs.find(
    (log) =>
      log.level === 'always' &&
      /Another Workflow: changed/.test(`${log.message}`)
  );
  t.truthy(anotherLog);

  // my-workflow shouldn't appear (not changed locally)
  const myWorkflowLog = logs.find(
    (log) =>
      log.level === 'always' && /^\s*-\s*my-workflow/.test(`${log.message}`)
  );
  t.falsy(myWorkflowLog);
});

test.serial('Remove a whole workflow', async (t) => {
  const projectId = 'remove-workflow';
  server.addProject(makeMultiProject(projectId) as any);

  // pull multi workflow project
  const pullResult = await run(
    `openfn project pull ${projectId} --log-json -l debug`
  );
  t.falsy(pullResult.stderr);
  assertLog(t, extractLogs(pullResult.stdout), /Checked out project locally/i);

  let proj = server.state.projects[projectId];
  t.is(Object.keys(proj.workflows).length, 2);

  // remove another-workflow locally, like a user deleting the folder
  await rimraf(path.join(tmpDir, 'workflows/another-workflow'));

  // deploy
  const { stdout, stderr } = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.falsy(stderr);

  const logs = extractLogs(stdout);
  assertLog(t, logs, /Updated project/);
  assertLog(t, logs, /Another Workflow: deleted/);

  // the workflow must actually be gone from the server, not just unmentioned
  proj = server.state.projects[projectId];
  const workflows = Object.values(proj.workflows) as any[];
  t.is(workflows.length, 1);
  t.is(workflows[0].name, 'My Workflow');
});

test.serial('remove a step and its edge from a workflow', async (t) => {
  const projectId = 'remove-step';
  server.addProject(makeProject(projectId) as any);

  const pullResult = await run(
    `openfn project pull ${projectId} --log-json -l debug`
  );
  t.falsy(pullResult.stderr);
  assertLog(t, extractLogs(pullResult.stdout), /Checked out project locally/i);

  // Remove my-job and the edge into it, consistently, in the same edit - the
  // local project file has to do this itself, the CLI won't clean up a
  // dangling edge left pointing at a step that's no longer there.
  const workflowYamlPath = path.join(
    tmpDir,
    'workflows/my-workflow/my-workflow.yaml'
  );
  await fs.writeFile(
    workflowYamlPath,
    `id: my-workflow
name: My Workflow
start: webhook
steps:
  - id: webhook
    type: webhook
    enabled: true
    next: {}
`
  );
  await rimraf(path.join(tmpDir, 'workflows/my-workflow/my-job.js'));

  const { stdout, stderr } = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.falsy(stderr);

  const logs = extractLogs(stdout);
  assertLog(t, logs, /Updated project/);
  assertLog(t, logs, /My Job: removed/);

  // the job and its edge must actually be gone from the server
  const proj = server.state.projects[projectId];
  const wf = Object.values(proj.workflows).find(
    (w: any) => w.id === 'my-workflow-1'
  ) as any;
  const jobs = Array.isArray(wf.jobs) ? wf.jobs : Object.values(wf.jobs ?? {});
  const edges = Array.isArray(wf.edges)
    ? wf.edges
    : Object.values(wf.edges ?? {});
  t.is(jobs.length, 0);
  t.is(edges.length, 0);
});

test.serial('remove an edge, leaving both steps in place', async (t) => {
  const projectId = 'remove-edge';
  server.addProject(makeProject(projectId) as any);

  const pullResult = await run(
    `openfn project pull ${projectId} --log-json -l debug`
  );
  t.falsy(pullResult.stderr);
  assertLog(t, extractLogs(pullResult.stdout), /Checked out project locally/i);

  // Remove just the edge from webhook -> my-job, keeping both steps as they
  // are. The local project file drops the `next` entry itself.
  const workflowYamlPath = path.join(
    tmpDir,
    'workflows/my-workflow/my-workflow.yaml'
  );
  await fs.writeFile(
    workflowYamlPath,
    `id: my-workflow
name: My Workflow
start: webhook
steps:
  - id: my-job
    name: My Job
    adaptor: '@openfn/language-common@latest'
    expression: ./my-job.js
  - id: webhook
    type: webhook
    enabled: true
    next: {}
`
  );

  const { stdout, stderr } = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.falsy(stderr);

  const logs = extractLogs(stdout);
  assertLog(t, logs, /Updated project/);

  // both steps survive, but the edge between them must actually be gone
  const proj = server.state.projects[projectId];
  const wf = Object.values(proj.workflows).find(
    (w: any) => w.id === 'my-workflow-1'
  ) as any;
  const jobs = Array.isArray(wf.jobs) ? wf.jobs : Object.values(wf.jobs ?? {});
  const edges = Array.isArray(wf.edges)
    ? wf.edges
    : Object.values(wf.edges ?? {});
  t.is(jobs.length, 1);
  t.is(edges.length, 0);
});

/**
 * Joe notes
 *
 * 1. why is there no local version history?
 * 2. the remote change gets dropped in the merge
 *
 * I suspect the fail here is catching a real bug
 */
test.serial.skip(
  'only locally changed workflows are deployed when remote also changes',
  async (t) => {
    const projectId = 'eeeeeeee';
    server.addProject(makeMultiProject(projectId));

    // pull workflow
    const pullResult = await run(
      `openfn project pull ${projectId} --log-json -l debug`
    );
    t.falsy(pullResult.stderr);

    // update my-workflow remotely
    server.addNode(projectId, 'my-workflow-1', {
      name: 'New Job',
      adaptor: '@openfn/language-common@latest',
      body: 'fn(state => ({ ...state, remote: true }))',
    });

    // modify another-workflow locally
    const exprPath = path.join(
      tmpDir,
      'workflows/another-workflow/another-job.js'
    );
    await fs.writeFile(exprPath, "post('http://success.org')");

    // deploy
    const { stdout, stderr } = await run(
      `openfn project deploy --no-confirm  -l debug`
    );
    console.log(stdout);
    t.falsy(stderr);
    const logs = extractLogs(stdout);
    assertLog(t, logs, /Updated project/);

    const anotherLog = logs.find(
      (log) =>
        log.level === 'always' && /another-workflow/.test(`${log.message}`)
    );
    t.truthy(anotherLog);

    // TODO it fails to deploy the local changes to the server
    // console.log(JSON.stringify(server.state.projects[projectId], undefined, 2));
  }
);

test.serial('warn when local and remote workflows have diverged', async (t) => {
  const projectId = 'ffffffff';
  server.addProject(makeProject(projectId) as any);

  const exprPath = path.join(tmpDir, 'workflows/my-workflow/my-job.js');

  // base
  await run(`openfn project pull ${projectId} --log-json -l debug`);
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, v: 1 }))');
  const firstDeploy = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  assertLog(t, extractLogs(firstDeploy.stdout), /Updated project/);

  // remote changed from base
  const project = server.state.projects[projectId];
  const wf = Object.values(project.workflows as any).find(
    (w: any) => w.id === 'my-workflow-1'
  ) as any;
  server.updateWorkflow(projectId, {
    ...wf,
    jobs: Object.values(wf.jobs ?? {}).map((j: any) =>
      j.id === 'my-job-1'
        ? { ...j, body: 'fn(state => ({ ...state, remote: true }))' }
        : j
    ),
  });

  // local changed from base
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, local: true }))');

  // deploy with divergence
  const { stdout, err } = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.truthy(err);
  const logs = extractLogs(stdout);
  assertLog(t, logs, /have diverged/i);
  assertLog(t, logs, /Projects have diverged/i);
});

test.serial(
  'deploy a pulled v2 state file as a new project',
  async (t) => {
    const projectId = 'iiiiiiii';
    server.addProject(makeProject(projectId) as any);

    const before = Object.keys(server.state.projects);

    // pull with an alias, producing a fetched v2 state file that has a uuid
    const pullResult = await run(
      `openfn project pull ${projectId} --alias og --log-json -l debug`
    );
    t.falsy(pullResult.stderr);

    const pulledPath = path.join(tmpDir, '.projects', 'og@localhost.yaml');

    // deploy that exact file back as a duplicate
    const { stdout, stderr } = await run(
      `openfn project deploy ${pulledPath} --new --name my-duplicate --no-confirm --log-json -l debug`
    );
    t.falsy(stderr);

    const logs = extractLogs(stdout);
    assertLog(t, logs, /Created new project/);

    const after = Object.keys(server.state.projects);
    t.is(after.length, before.length + 1);

    const newId = after.find((id) => !before.includes(id));
    t.not(newId, projectId);

    const proj = server.state.projects[newId!];
    t.is(proj.name, 'my-duplicate');

    const workflows = Object.values(proj.workflows) as any[];
    t.is(workflows.length, 1);
    t.is(workflows[0].name, 'My Workflow');
  }
);

test.serial(
  'deploy a pulled state file to a different tracked project',
  async (t) => {
    const mainId = 'llllllll-main';
    const stagingId = 'llllllll-staging';

    server.addProject(makeProject(mainId) as any);
    const stagingFixture = makeProject(stagingId) as any;
    // give staging a distinct id/name and content, otherwise it's
    // indistinguishable from main once both are tracked locally
    stagingFixture.name = 'staging-project';
    stagingFixture.workflows[0].jobs[0].body = "post('STAGING')";
    server.addProject(stagingFixture);

    // track both locally, same as any other pull
    await run(
      `openfn project pull ${mainId} --alias main --log-json -l debug`
    );
    await run(
      `openfn project pull ${stagingId} --alias staging --log-json -l debug`
    );

    const mainPath = path.join(tmpDir, '.projects', 'main@localhost.yaml');

    // deploy main's pulled file, but target staging instead of main
    const { stdout, stderr } = await run(
      `openfn project deploy ${mainPath} staging --no-confirm --log-json -l debug`
    );
    t.falsy(stderr);
    assertLog(t, extractLogs(stdout), /Updated project/);

    // staging's remote content now matches main's, replacing its own...
    const stagingProj = server.state.projects[stagingId];
    t.is(stagingProj.name, 'staging-project');
    t.regex(
      stagingProj.workflows['my-workflow-1'].jobs['my-job'].body,
      /fn\(s => s\)/
    );

    // ...while main itself was left untouched
    const mainProj = server.state.projects[mainId];
    t.regex(mainProj.workflows[0].jobs[0].body, /fn\(s => s\)/);
  }
);

test.serial(
  'deploy collections: add a collection via openfn.yaml',
  async (t) => {
    const projectId = 'gggggggg';
    server.addProject(makeProject(projectId) as any);

    t.is(server.state.projects[projectId].collections.length, 0);

    // pull the project - no collections yet
    const pullResult = await run(
      `openfn project pull ${projectId} --log-json -l debug`
    );
    t.falsy(pullResult.stderr);
    assertLog(
      t,
      extractLogs(pullResult.stdout),
      /Checked out project locally/i
    );

    const openfnPath = path.resolve(tmpDir, 'openfn.yaml');
    const before: any = yamlToJson(await fs.readFile(openfnPath, 'utf8'));
    t.falsy(before.project.collections);

    // add a collection by hand - no workflow files are touched
    before.project.collections = ['my-collection'];
    await fs.writeFile(openfnPath, jsonToYaml(before));

    const { stdout, stderr } = await run(
      `openfn project deploy --no-confirm --log-json -l debug`
    );
    t.falsy(stderr);

    const logs = extractLogs(stdout);
    // a collections-only edit must still trigger a real deploy
    assertLog(t, logs, /Updated project/);

    const collections = server.state.projects[projectId].collections;
    t.is(collections.length, 1);
    t.is(collections[0].name, 'my-collection');
    t.truthy(collections[0].id);
    t.falsy(collections[0].delete);
  }
);

test.serial('deploy a v2 project spec file as a new project', async (t) => {
  const before = Object.keys(server.state.projects);

  const specYaml = `id: exported-project
name: My Exported Project
schema_version: '4.0'
workflows:
  - id: my-workflow
    name: My Workflow
    start: webhook
    steps:
      - id: webhook
        type: webhook
        enabled: true
        next:
          transform-data:
            condition: always
      - id: transform-data
        name: Transform data
        expression: 'fn(s => s)'
        adaptor: '@openfn/language-common@latest'
`;

  const exportedPath = path.join(tmpDir, 'exported-project.yaml');
  await fs.writeFile(exportedPath, specYaml);

  const { stdout, stderr } = await run(
    `openfn project deploy ${exportedPath} --name my-duplicate --no-confirm --log-json -l debug`
  );
  t.falsy(stderr);

  const logs = extractLogs(stdout);
  assertLog(t, logs, /Created new project/);

  const after = Object.keys(server.state.projects);
  t.is(after.length, before.length + 1);

  const newId = after.find((id) => !before.includes(id));
  const proj = server.state.projects[newId!];

  t.is(proj.name, 'my-duplicate');

  const workflows = Object.values(proj.workflows) as any[];
  t.is(workflows.length, 1);
  t.is(workflows[0].name, 'My Workflow');

  const jobs = Object.values(workflows[0].jobs) as any[];
  t.is(jobs.length, 1);
  t.is(jobs[0].body, 'fn(s => s)');
  t.is(jobs[0].adaptor, '@openfn/language-common@latest');

  const triggers = Object.values(workflows[0].triggers) as any[];
  t.is(triggers.length, 1);
  t.is(triggers[0].type, 'webhook');

  const edges = Object.values(workflows[0].edges) as any[];
  t.is(edges.length, 1);
});

test.serial(
  'deploy collections: remove a collection via openfn.yaml',
  async (t) => {
    const projectId = 'hhhhhhhh';
    server.addProject({
      ...makeProject(projectId),
      collections: [{ id: 'coll-remove', name: 'my-collection' }],
    } as any);

    t.is(server.state.projects[projectId].collections.length, 1);

    // pull the project - openfn.yaml should list the fetched collection
    const pullResult = await run(
      `openfn project pull ${projectId} --log-json -l debug`
    );
    t.falsy(pullResult.stderr);
    assertLog(
      t,
      extractLogs(pullResult.stdout),
      /Checked out project locally/i
    );

    const openfnPath = path.resolve(tmpDir, 'openfn.yaml');
    const before: any = yamlToJson(await fs.readFile(openfnPath, 'utf8'));
    t.deepEqual(before.project.collections, ['my-collection']);

    // remove the collection by hand - no workflow files are touched
    before.project.collections = [];
    await fs.writeFile(openfnPath, jsonToYaml(before));

    const { stdout, stderr } = await run(
      `openfn project deploy --no-confirm --log-json -l debug`
    );
    t.falsy(stderr);

    const logs = extractLogs(stdout);
    // a collections-only edit must still trigger a real deploy
    assertLog(t, logs, /Updated project/);

    // the deleted collection should be gone from the project entirely
    t.is(server.state.projects[projectId].collections.length, 0);
  }
);
