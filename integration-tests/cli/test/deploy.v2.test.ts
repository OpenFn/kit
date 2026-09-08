import test from 'ava';
import path from 'node:path';
import fs from 'node:fs/promises';
import run from '../src/run';
import createLightningServer from '@openfn/lightning-mock';
import Project from '@openfn/project';
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
