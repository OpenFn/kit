import test from 'ava';
import path from 'node:path';
import fs from 'node:fs/promises';
import run from '../src/run';
import createLightningServer from '@openfn/lightning-mock';
import { extractLogs, assertLog } from '../src/util';
import { rimraf } from 'rimraf';
import { makeProject } from './fixtures/projects';

let server: any;
const port = 8967;
const endpoint = `http://localhost:${port}`;
let tmpDir = path.resolve('tmp/deploy');

const testProject = `
name: test-project
workflows:
  My-Workflow:
    name: My Workflow
    jobs:
      my-job:
        name: My Job
        adaptor: '@openfn/language-common@latest'
        body: 'fn(s => s)'
    triggers:
      webhook:
        type: webhook
        enabled: true
    edges:
      webhook->my-job:
        condition_type: always
        source_trigger: webhook
        target_job: my-job
`.trim();

const testProjectMulti = `
name: test-project
workflows:
  My-Workflow:
    name: My Workflow
    jobs:
      my-job:
        name: My Job
        adaptor: '@openfn/language-common@latest'
        body: 'fn(s => s)'
    triggers:
      webhook:
        type: webhook
        enabled: true
    edges:
      webhook->my-job:
        condition_type: always
        source_trigger: webhook
        target_job: my-job
  Another-Workflow:
    name: Another Workflow
    jobs:
      another-job:
        name: Another Job
        adaptor: '@openfn/language-http@latest'
        body: "get('http://example.com')"
    triggers:
      webhook:
        type: webhook
        enabled: true
    edges:
      webhook->another-job:
        condition_type: always
        source_trigger: webhook
        target_job: another-job
`.trim();

test.before(async () => {
  server = await createLightningServer({ port });

  process.env.IGNORE_DOT_ENV = 'true';
  process.env.OPENFN_ENDPOINT = endpoint;
  process.env.OPENFN_API_KEY = 'test-key';
});

test.beforeEach(async () => {
  await rimraf(tmpDir);
  await fs.mkdir(tmpDir, { recursive: true });
  server.reset();
});

test.serial('deploy a local project', async (t) => {
  await fs.writeFile(path.join(tmpDir, 'project.yaml'), testProject);

  t.is(Object.keys(server.state.projects).length, 0);

  const { stdout, stderr } = await run(
    `openfn deploy \
      --project-path ${tmpDir}/project.yaml \
      --state-path ${tmpDir}/.state.json \
      --no-confirm \
      --log-json \
      -l debug`
  );

  t.falsy(stderr);

  const logs = extractLogs(stdout);
  assertLog(t, logs, /Deployed/);

  t.is(Object.keys(server.state.projects).length, 1);
  const [project] = Object.values(server.state.projects);
  t.is(project.name, 'test-project');
});

test.serial('Update a project', async (t) => {
  const projectYamlUpdated = testProject.replace(
    "body: 'fn(s => s)'",
    "body: 'fn(s => ({ ...s, updated: true }))'"
  );

  const projectPath = path.join(tmpDir, 'project.yaml');
  const statePath = path.join(tmpDir, '.state.json');

  await fs.writeFile(projectPath, testProject);

  t.is(Object.keys(server.state.projects).length, 0);

  // first deployment
  const deployCmd = `openfn deploy \
      --project-path ${projectPath} \
      --state-path ${statePath} \
      --no-confirm \
      --log-json -l debug`;
  const first = await run(deployCmd);
  t.falsy(first.stderr);
  assertLog(t, extractLogs(first.stdout), /Deployed/);

  t.is(Object.keys(server.state.projects).length, 1);

  // second deployment after update
  await fs.writeFile(projectPath, projectYamlUpdated);

  const { stdout, stderr } = await run(deployCmd);
  t.falsy(stderr);

  const logs = extractLogs(stdout);
  assertLog(t, logs, /Deployed/);

  const changesLog = logs.find(
    (log) => log.level === 'always' && /Changes\:/.test(`${log.message}`)
  );
  t.regex(changesLog.message[0], /fn\(s => s\)/);
  t.regex(changesLog.message[0], /fn\(s => \(\{ \.\.\.s, updated: true \}\)\)/);

  t.is(Object.keys(server.state.projects).length, 1);

  const [project] = Object.values(server.state.projects) as any[];
  t.is(project.name, 'test-project');

  const [workflow] = Object.values(project.workflows);
  t.regex(workflow.jobs[0].body, /updated/);
});

test.serial('pull a project', async (t) => {
  const projectPath = path.join(tmpDir, 'project.yaml');
  const statePath = path.join(tmpDir, '.state.json');

  await fs.writeFile(projectPath, testProjectMulti);

  // deploy a fresh project to set up the server
  const deployCmd = `openfn deploy \
    --project-path ${projectPath} \
    --state-path ${statePath} \
    --no-confirm \
    --log-json -l debug`;

  await run(deployCmd);

  t.is(Object.keys(server.state.projects).length, 1);

  const [projectId] = Object.keys(server.state.projects);

  // Clear the working dir, like it never existed locally
  rimraf(`${tmpDir}/*`);

  // Now pull the project as if it's fresh
  const { stdout, stderr } = await run(
    `openfn pull ${projectId} \
      --project-path ${projectPath} \
      --state-path ${statePath} \
      --log-json`
  );

  t.falsy(stderr);

  assertLog(t, extractLogs(stdout), /Project pulled successfully/i);

  const pulledState = JSON.parse(await fs.readFile(statePath, 'utf8'));
  const workflow = Object.values(pulledState.workflows)[0] as any;
  t.truthy(workflow.version_history);
  t.is(workflow.version_history.length, 1);
});

test.serial('redirect to v2 protocol if openfn.yaml is present', async (t) => {
  const projectId = 'redirect-test-1';
  server.addProject(makeProject(projectId) as any);

  // create an empty openfn.yaml to trigger the v1 -> v2 redirect
  await fs.writeFile(path.join(tmpDir, 'openfn.yaml'), '');

  const bootstrap = await run(
    `openfn pull ${projectId} --workspace ${tmpDir} --log-json -l debug`
  );
  t.falsy(bootstrap.stderr);
  assertLog(t, extractLogs(bootstrap.stdout), /Detected openfn.yaml file/i);

  const yaml = await fs.readFile(path.join(tmpDir, 'openfn.yaml'), 'utf8');
  t.regex(yaml, new RegExp(`uuid\\: ${projectId}`));

  const workflowYaml = await fs.readFile(
    path.join(tmpDir, 'workflows/my-workflow/my-workflow.yaml'),
    'utf8'
  );
  t.regex(workflowYaml, /id: my-workflow/);
  t.regex(workflowYaml, /name: My Workflow/);
  t.regex(workflowYaml, /expression: \.\/my-job\.js/);

  const stepJs = await fs.readFile(
    path.join(tmpDir, 'workflows/my-workflow/my-job.js'),
    'utf8'
  );
  t.is(stepJs, 'fn(s => s)');

  // simulate a remote change
  const remoteProject = server.state.projects[projectId];
  const wf = Object.values(remoteProject.workflows as any).find(
    (w: any) => w.id === 'my-workflow-1'
  ) as any;
  server.updateWorkflow(projectId, {
    ...wf,
    jobs: Object.values(wf.jobs ?? {}).map((j: any) =>
      j.id === 'my-job-1'
        ? { ...j, body: 'fn(s => ({ ...s, remote: true }))' }
        : j
    ),
  });

  // v1 pull -> should redirect to v2 because openfn.yaml exists
  const pullResult = await run(
    `openfn pull ${projectId} --workspace ${tmpDir} --log-json -l debug`
  );
  t.falsy(pullResult.stderr);
  assertLog(t, extractLogs(pullResult.stdout), /Detected openfn.yaml file/i);

  const exprPath = path.join(tmpDir, 'workflows/my-workflow/my-job.js');
  t.regex(await fs.readFile(exprPath, 'utf8'), /remote: true/);

  // make a local change
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, local: true }))');

  // v1 deploy -> should redirect to v2
  const { stdout, stderr } = await run(
    `openfn deploy --workspace ${tmpDir} --no-confirm --log-json -l debug`
  );
  t.falsy(stderr);
  assertLog(t, extractLogs(stdout), /Detected openfn.yaml file/i);

  // confirm the local change made it to the server
  const serverProj = server.state.projects[projectId];
  t.regex(
    serverProj.workflows['my-workflow-1'].jobs['my-job'].body,
    /local: true/
  );
});

test.serial('deploy a v2 spec file', async (t) => {
  const testProjectV2 = `
name: test-project
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
          my-job: {}
      - id: my-job
        name: My Job
        expression: 'fn(s => s)'
        adaptor: '@openfn/language-common@latest'
`.trim();

  await fs.writeFile(path.join(tmpDir, 'project.yaml'), testProjectV2);

  t.is(Object.keys(server.state.projects).length, 0);

  const { stdout, stderr } = await run(
    `openfn deploy \
      --project-path ${tmpDir}/project.yaml \
      --state-path ${tmpDir}/.state.json \
      --no-confirm \
      --log-json \
      -l debug`
  );

  t.falsy(stderr);

  const logs = extractLogs(stdout);
  assertLog(t, logs, /v2 spec/i);
  assertLog(t, logs, /Deployed/);

  t.is(Object.keys(server.state.projects).length, 1);
  const [project] = Object.values(server.state.projects) as any[];
  t.is(project.name, 'test-project');
  const [workflow] = Object.values(project.workflows) as any[];
  t.is(workflow.name, 'My Workflow');
});

test.serial('deploy then pull, changes one workflow, deploy', async (t) => {
  t.is(Object.keys(server.state.projects).length, 0);

  const projectYamlUpdated = testProjectMulti.replace(
    'body: "get(\'http://example.com\')"',
    'body: "post(\'http://success.org\')"'
  );
  const projectPath = path.join(tmpDir, 'project.yaml');
  const statePath = path.join(tmpDir, '.state.json');

  await fs.writeFile(projectPath, testProjectMulti);

  // deploy fresh project
  const deployCmd = `openfn deploy \
      --project-path ${projectPath} \
      --state-path ${statePath} \
      --no-confirm \
      --log debug \
      --log-json`;
  await run(deployCmd);

  t.is(Object.keys(server.state.projects).length, 1);

  const { id: projectId } = JSON.parse(await fs.readFile(statePath, 'utf8'));

  t.truthy(projectId);
  t.truthy(server.state.projects[projectId]);

  // pull the project back
  const pullResult = await run(
    `openfn pull ${projectId} \
      --project-path ${projectPath} \
      --state-path ${statePath} \
      --log-json`
  );

  t.falsy(pullResult.stderr);
  assertLog(t, extractLogs(pullResult.stdout), /Project pulled successfully/i);

  const pulledState = JSON.parse(await fs.readFile(statePath, 'utf8'));
  const workflow = Object.values(pulledState.workflows)[0] as any;
  t.truthy(workflow.version_history);
  t.is(workflow.version_history.length, 1);

  // change the local workflow yaml
  await fs.writeFile(projectPath, projectYamlUpdated);

  // And deploy those changes
  const { stdout, stderr } = await run(deployCmd);

  t.falsy(stderr);

  const logs = extractLogs(stdout);
  assertLog(t, logs, /Deployed/);
  const changesLog = logs.find(
    (log) => log.level === 'always' && /Changes\:/.test(`${log.message}`)
  );
  t.regex(changesLog.message[0], /\-.+body: \"get\('http:\/\/example.com'\)\"/);
  t.regex(changesLog.message[0], /\+.+body: \"post\('http:\/\/success.org'\)"/);

  t.is(Object.keys(server.state.projects).length, 1);
  t.truthy(server.state.projects[projectId]);
});
