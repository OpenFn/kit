import test from 'ava';
import path from 'node:path';
import fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { rimraf } from 'rimraf';
import createLightningServer from '@openfn/lightning-mock';

const port = 8977;
const endpoint = `http://localhost:${port}`;
const tmpDir = path.resolve('tmp/deploy');

let server;

// Run the globally-installed openfn CLI (the tarball under test)
const run = (cmd) =>
  new Promise((resolve) => {
    exec(cmd, { env: process.env }, (err, stdout, stderr) => {
      resolve({ err, stdout, stderr });
    });
  });

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
  // log the node version so CI confirms we're on the legacy runtime
  t.log(process.version);

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
  t.regex(stdout, /"message"\:\["Deployed"\]/);

  t.is(Object.keys(server.state.projects).length, 1);
  const [project] = Object.values(server.state.projects);
  t.is(project.name, 'test-project');
});
