import test from 'ava';
import path from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';
import { exec } from 'node:child_process';
import { rimraf } from 'rimraf';

const tmpDir = path.resolve('tmp/deploy');

let server;
let endpoint;
let lastDeploy; // the payload the CLI POSTs to the provisioning endpoint

// A minimal stand-in for Lightning's provisioning API
const createMockServer = () =>
  new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      if (!req.url.startsWith('/api/provision')) {
        res.statusCode = 404;
        return res.end();
      }

      if (req.method === 'GET') {
        // pretend no project exists yet, so everything is a "new" change
        res.statusCode = 404;
        return res.end();
      }

      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        lastDeploy = JSON.parse(body);
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ data: lastDeploy }));
      });
    });
    srv.listen(0, () => resolve(srv));
  });

const run = (cmd) =>
  new Promise((resolve) => {
    exec(cmd, (err, stdout, stderr) => {
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
  server = await createMockServer();
  endpoint = `http://localhost:${server.address().port}`;

  process.env.IGNORE_DOT_ENV = 'true';
  process.env.OPENFN_ENDPOINT = endpoint;
  process.env.OPENFN_API_KEY = 'test-key';
});

test.after.always(() => {
  server?.close();
});

test.beforeEach(async () => {
  await rimraf(tmpDir);
  await fs.mkdir(tmpDir, { recursive: true });
  lastDeploy = undefined;
});

test.serial('deploy a local project', async (t) => {
  // log the node version so CI confirms we're on the legacy runtime
  t.log(process.version);

  await fs.writeFile(path.join(tmpDir, 'project.yaml'), testProject);

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

  // the CLI should have posted our project to the mock endpoint
  t.truthy(lastDeploy);
  t.is(lastDeploy.name, 'test-project');
});
