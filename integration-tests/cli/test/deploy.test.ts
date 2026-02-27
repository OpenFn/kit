import test from 'ava';
import path from 'node:path';
import fs from 'node:fs/promises';
import run from '../src/run';
import createLightningServer, {
  DEFAULT_PROJECT_ID,
} from '@openfn/lightning-mock';
import { extractLogs, assertLog } from '../src/util';
import { rimraf } from 'rimraf';

// set up a lightning mock

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

test.before(async () => {
  server = await createLightningServer({ port });
});

test.beforeEach(async () => {
  await fs.mkdir(tmpDir, { recursive: true });
});

test.afterEach(async () => {
  await rimraf(tmpDir);
});

test.serial('deploy a local project to lightning mock', async (t) => {
  await fs.writeFile(path.join(tmpDir, 'project.yaml'), testProject);

  const { stdout, stderr } = await run(
    `OPENFN_ENDPOINT=${endpoint} OPENFN_API_KEY=test-key openfn deploy \
      --project-path ${tmpDir}/project.yaml \
      --state-path ${tmpDir}/.state.json \
      --no-confirm \
      --log-json -l debug`
  );

  t.falsy(stderr);

  const logs = extractLogs(stdout);
  assertLog(t, logs, /Deployed/);
});

test.serial('deploy a project, update workflow, deploy again', async (t) => {
  const projectYamlUpdated = testProject.replace(
    "body: 'fn(s => s)'",
    "body: 'fn(s => ({ ...s, updated: true }))'"
  );

  const projectPath = path.join(tmpDir, 'project.yaml');
  const statePath = path.join(tmpDir, '.state.json');

  const deployCmd = `OPENFN_ENDPOINT=${endpoint} OPENFN_API_KEY=test-key openfn deploy \
    --project-path ${projectPath} \
    --state-path ${statePath} \
    --no-confirm \
    --log-json -l debug`;

  // first deployment
  await fs.writeFile(projectPath, testProject);
  const first = await run(deployCmd);
  t.falsy(first.stderr);
  assertLog(t, extractLogs(first.stdout), /Deployed/);

  // second deployment after update
  await fs.writeFile(projectPath, projectYamlUpdated);
  const { stdout, stderr } = await run(deployCmd);
  const logs = extractLogs(stdout);
  t.falsy(stderr);
  assertLog(t, logs, /Deployed/);
  const changesLog = logs.find(
    (log) => log.level === 'always' && /Changes\:/.test(`${log.message}`)
  );
  t.regex(changesLog.message[0], /fn\(s => s\)/);
  t.regex(changesLog.message[0], /fn\(s => \(\{ \.\.\.s, updated: true \}\)\)/);
});

test.serial('deploy then pull to check version history', async (t) => {
  const projectPath = path.join(tmpDir, 'project.yaml');
  const statePath = path.join(tmpDir, '.state.json');

  await fs.writeFile(projectPath, testProject);

  const deployCmd = `OPENFN_ENDPOINT=${endpoint} OPENFN_API_KEY=test-key openfn deploy \
    --project-path ${projectPath} \
    --state-path ${statePath} \
    --no-confirm \
    --log-json -l debug`;

  const deployResult = await run(deployCmd);
  t.falsy(deployResult.stderr);
  assertLog(t, extractLogs(deployResult.stdout), /Deployed/);

  const stateAfterDeploy = JSON.parse(await fs.readFile(statePath, 'utf8'));
  // console.log("passed-here", stateAfterDeploy)
  const projectId = stateAfterDeploy.id;
  t.truthy(projectId);

  const pullResult = await run(
    `OPENFN_ENDPOINT=${endpoint} OPENFN_API_KEY=test-key openfn pull ${projectId} \
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
});

// This should fail against the built CLI right now
test.serial(
  `OPENFN_ENDPOINT=${endpoint} openfn pull ${DEFAULT_PROJECT_ID} --log-json`,
  async (t) => {
    const { stdout, stderr } = await run(t.title);
    t.falsy(stderr);

    const stdlogs = extractLogs(stdout);
    assertLog(t, stdlogs, /Project pulled successfully/i);

    // TODO what's an elegant way to tidy up here?
    await rimraf('project.yaml');
    await rimraf('.state.json');
  }
);
