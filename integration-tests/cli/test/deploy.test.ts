import test from 'ava';
import path from 'node:path';
import fs from 'node:fs/promises';
import run from '../src/run';
import createLightningServer from '@openfn/lightning-mock';
import { extractLogs, assertLog } from '../src/util';
import { rimraf } from 'rimraf';

let server: any;
const port = 8967;
const endpoint = `http://localhost:${port}`;
let tmpDir = path.resolve('tmp/deploy');

const testProject = `
name: test-project
workflows:
  my-workflow:
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
  my-workflow:
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
  another-workflow:
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
  await fs.mkdir(tmpDir, { recursive: true });
  server.reset();
});

test.afterEach(async () => {
  await rimraf(tmpDir);
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

  const deployCmd = `openfn deploy \
      --project-path ${projectPath} \
      --state-path ${statePath} \
      --no-confirm \
      --log-json -l debug`;

  t.is(Object.keys(server.state.projects).length, 0);

  // first deployment
  await fs.writeFile(projectPath, testProject);
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

test.serial('deploy then pull, changes one workflow, deploy', async (t) => {
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
    --log-json -l debug`;

  t.is(Object.keys(server.state.projects).length, 0);

  const deployResult = await run(deployCmd);
  t.falsy(deployResult.stderr);
  assertLog(t, extractLogs(deployResult.stdout), /Deployed/);

  t.is(Object.keys(server.state.projects).length, 1);

  const stateAfterDeploy = JSON.parse(await fs.readFile(statePath, 'utf8'));
  const projectId = stateAfterDeploy.id;
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

  // now deploy with changes to one workflow
  await fs.writeFile(projectPath, projectYamlUpdated);
  const { stdout, stderr } = await run(deployCmd);
  const logs = extractLogs(stdout);
  t.falsy(stderr);
  assertLog(t, logs, /Deployed/);
  const changesLog = logs.find(
    (log) => log.level === 'always' && /Changes\:/.test(`${log.message}`)
  );
  t.regex(changesLog.message[0], /\-.+body: \"get\('http:\/\/example.com'\)\"/);
  t.regex(changesLog.message[0], /\+.+body: \"post\('http:\/\/success.org'\)"/);

  t.is(Object.keys(server.state.projects).length, 1);
  t.truthy(server.state.projects[projectId]);
});
