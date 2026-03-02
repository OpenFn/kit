import test from 'ava';
import path from 'node:path';
import fs from 'node:fs/promises';
import run from '../src/run';
import createLightningServer, {
  DEFAULT_PROJECT_ID,
} from '@openfn/lightning-mock';
import Project from '@openfn/project';
import { extractLogs, assertLog } from '../src/util';
import { rimraf } from 'rimraf';

let server: ReturnType<typeof createLightningServer>;

// Use a different port to avoid conflicts with deploy.test.ts (8967)
const port = 8968;
const endpoint = `http://localhost:${port}`;

const tmpDir = path.resolve('tmp/deploy-v2');

const makeProject = (id: string) => ({
  id,
  name: 'test-project',
  workflows: [
    {
      id: 'my-workflow-1',
      name: 'My Workflow',
      jobs: [
        {
          id: 'my-job-1',
          name: 'My Job',
          body: 'fn(s => s)',
          adaptor: '@openfn/language-common@latest',
          project_credential_id: null,
        },
      ],
      triggers: [{ id: 'my-trigger-1', type: 'webhook', enabled: true }],
      edges: [
        {
          id: 'my-edge-1',
          condition_type: 'always',
          source_trigger_id: 'my-trigger-1',
          target_job_id: 'my-job-1',
          enabled: true,
        },
      ],
      lock_version: 1,
      deleted_at: null,
    },
  ],
  project_credentials: [],
  collections: [],
});

// A two-workflow project for isolation/divergence tests
const makeMultiProject = (id: string) => ({
  id,
  name: 'test-project',
  workflows: [
    {
      id: 'my-workflow-1',
      name: 'My Workflow',
      jobs: [
        {
          id: 'my-job-1',
          name: 'My Job',
          body: 'fn(s => s)',
          adaptor: '@openfn/language-common@latest',
          project_credential_id: null,
        },
      ],
      triggers: [{ id: 'my-trigger-1', type: 'webhook', enabled: true }],
      edges: [
        {
          id: 'my-edge-1',
          condition_type: 'always',
          source_trigger_id: 'my-trigger-1',
          target_job_id: 'my-job-1',
          enabled: true,
        },
      ],
      lock_version: 1,
      deleted_at: null,
    },
    {
      id: 'another-workflow-1',
      name: 'Another Workflow',
      jobs: [
        {
          id: 'another-job-1',
          name: 'Another Job',
          body: "get('http://example.com')",
          adaptor: '@openfn/language-http@latest',
          project_credential_id: null,
        },
      ],
      triggers: [{ id: 'another-trigger-1', type: 'webhook', enabled: true }],
      edges: [
        {
          id: 'another-edge-1',
          condition_type: 'always',
          source_trigger_id: 'another-trigger-1',
          target_job_id: 'another-job-1',
          enabled: true,
        },
      ],
      lock_version: 1,
      deleted_at: null,
    },
  ],
  project_credentials: [],
  collections: [],
});

test.before(async () => {
  server = await createLightningServer({ port });
});

test.beforeEach(async () => {
  await fs.mkdir(tmpDir, { recursive: true });
});

test.afterEach(async () => {
  await rimraf(tmpDir);
});

const pullCmd = (projectId: string) =>
  `OPENFN_ENDPOINT=${endpoint} OPENFN_API_KEY=test-key openfn project pull ${projectId} --workspace ${tmpDir} --log-json -l debug`;

const deployCmd = () =>
  `OPENFN_ENDPOINT=${endpoint} OPENFN_API_KEY=test-key openfn project deploy --workspace ${tmpDir} --no-confirm --log-json -l debug`;

test.serial('pull and deploy a project', async (t) => {
  const projectId = 'aaaaaaaa';
  server.addProject(makeProject(projectId) as any);

  // pull the project to set up workspace
  const pullResult = await run(pullCmd(projectId));
  t.falsy(pullResult.stderr);
  assertLog(t, extractLogs(pullResult.stdout), /Checked out project locally/i);

  // modify expression to trigger a change
  const exprPath = path.join(tmpDir, 'workflows/my-workflow/my-job.js');
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, deployed: true }))');

  // deploy
  const { stdout, stderr } = await run(deployCmd());
  t.falsy(stderr);
  assertLog(t, extractLogs(stdout), /Updated project/);
});

test.serial('deploy a project, update workflow, deploy again', async (t) => {
  const projectId = 'bbbbbbbb';
  server.addProject(makeProject(projectId) as any);

  const exprPath = path.join(tmpDir, 'workflows/my-workflow/my-job.js');

  // pull
  const pullResult = await run(pullCmd(projectId));
  t.falsy(pullResult.stderr);

  // first deploy
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, v: 1 }))');
  const first = await run(deployCmd());
  t.falsy(first.stderr);
  assertLog(t, extractLogs(first.stdout), /Updated project/);

  // second deploy after another update
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, v: 2 }))');
  const { stdout, stderr } = await run(deployCmd());
  t.falsy(stderr);
  const logs = extractLogs(stdout);
  assertLog(t, logs, /Updated project/);
  assertLog(t, logs, /Workflows modified/);
});

test.serial('deploy and pull to check version history', async (t) => {
  const projectId = 'cccccccc';
  server.addProject(makeProject(projectId) as any);

  const exprPath = path.join(tmpDir, 'workflows/my-workflow/my-job.js');

  // pull and modify
  await run(pullCmd(projectId));
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, v: 1 }))');

  // deploy then pull
  const { stderr } = await run(deployCmd());
  t.falsy(stderr);
  await run(pullCmd(projectId));

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
  const pullResult = await run(pullCmd(projectId));
  t.falsy(pullResult.stderr);
  assertLog(t, extractLogs(pullResult.stdout), /Checked out project locally/i);

  // modify another-workflow
  const exprPath = path.join(
    tmpDir,
    'workflows/another-workflow/another-job.js'
  );
  await fs.writeFile(exprPath, "post('http://success.org')");

  // deploy
  const { stdout, stderr } = await run(deployCmd());
  t.falsy(stderr);
  const logs = extractLogs(stdout);
  assertLog(t, logs, /Updated project/);

  // another-workflow should appear in the modified list
  const anotherLog = logs.find(
    (log) => log.level === 'always' && /another-workflow/.test(`${log.message}`)
  );
  t.truthy(anotherLog);

  // my-workflow shouldn't appear (not changed locally)
  const myWorkflowLog = logs.find(
    (log) =>
      log.level === 'always' && /^\s*-\s*my-workflow/.test(`${log.message}`)
  );
  t.falsy(myWorkflowLog);
});

test.serial(
  'only locally changed workflows are deployed when remote also changes',
  async (t) => {
    const projectId = 'eeeeeeee';
    server.addProject(makeMultiProject(projectId) as any);

    // pull workflow
    const pullResult = await run(pullCmd(projectId));
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
    const { stdout, stderr } = await run(deployCmd());
    t.falsy(stderr);
    const logs = extractLogs(stdout);
    console.log('deploy-logs:', logs);
    assertLog(t, logs, /Updated project/);

    const anotherLog = logs.find(
      (log) =>
        log.level === 'always' && /another-workflow/.test(`${log.message}`)
    );
    t.truthy(anotherLog);
    // TODO it fails to deploy the local changes to the server
    console.log(JSON.stringify(server.state.projects[projectId], undefined, 2));
  }
);

test.serial('warn when local and remote workflows have diverged', async (t) => {
  const projectId = 'ffffffff';
  server.addProject(makeProject(projectId) as any);

  const exprPath = path.join(tmpDir, 'workflows/my-workflow/my-job.js');

  // base
  await run(pullCmd(projectId));
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, v: 1 }))');
  const firstDeploy = await run(deployCmd());
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
  const { stdout, err } = await run(deployCmd());
  t.truthy(err);
  const logs = extractLogs(stdout);
  assertLog(t, logs, /have diverged/i);
  assertLog(t, logs, /Projects have diverged/i);
});

test.serial('pull a project from lightning mock', async (t) => {
  const { stdout, stderr } = await run(
    `OPENFN_ENDPOINT=${endpoint} OPENFN_API_KEY=test-key openfn project pull ${DEFAULT_PROJECT_ID} --workspace ${tmpDir} --log-json`
  );
  t.falsy(stderr);
  assertLog(t, extractLogs(stdout), /Checked out project locally/i);
});
