import test from 'ava';
import { rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import run from '../src/run';

const TMP_DIR = path.resolve('tmp/project-v1');

// These tests use the legacy v1 yaml structure

const mainYaml = `
id: 8dbc4349-52b4-4bf2-be10-fdf06da52c46
name: hello-world
description: Simple test project to test sandboxing and merging
project_credentials: []
collections: []
inserted_at: 2025-10-07T09:47:41Z
updated_at: 2025-10-07T09:47:41Z
env: null
color: null
concurrency: null
scheduled_deletion: null
parent_id: null
history_retention_period: null
allow_support_access: false
dataclip_retention_period: null
requires_mfa: false
retention_policy: retain_all
version_history: []
workflows:
  my-workflow:
    name: my workflow
    id: 0afbefab-5824-4911-aaae-a19f20106dec
    concurrency: null
    inserted_at: 2025-10-07T10:00:23Z
    updated_at: 2025-10-07T10:00:29Z
    deleted_at: null
    lock_version: 2
    jobs:
      transform-data:
        name: Transform data
        body: |
          fn(() => ({ x: 1}))
        adaptor: "@openfn/language-common@latest"
        id: b8b780f3-98dd-4244-880b-e534d8f24547
        project_credential_id: null
    triggers:
      webhook:
        type: webhook
        enabled: true
        id: 3b4a47c0-7242-4f0c-8886-838e34762654
    edges:
      webhook->transform-data:
        id: 33dce70f-047f-4508-82fd-950eb508519b
        target_job_id: b8b780f3-98dd-4244-880b-e534d8f24547
        enabled: true
        source_trigger_id: 3b4a47c0-7242-4f0c-8886-838e34762654
        condition_type: always
`;

const stagingYaml = `
id: 5deddbfa-c63f-4dbc-98b5-a49d3395a488
name: hello-world-staging
description: "simulate a staging project "
project_credentials: []
collections: []
inserted_at: 2025-10-07T10:00:13Z
updated_at: 2025-10-07T10:00:13Z
env: null
color: null
concurrency: null
scheduled_deletion: null
parent_id: null
history_retention_period: null
allow_support_access: false
dataclip_retention_period: null
requires_mfa: false
retention_policy: retain_all
version_history: []
workflows:
  my-workflow:
    name: my workflow
    id: 9e2cc86a-8896-4a5a-9467-9c4128207fd3
    concurrency: null
    inserted_at: 2025-10-07T10:00:36Z
    updated_at: 2025-10-07T10:00:53Z
    deleted_at: null
    lock_version: 3
    jobs:
      transform-data:
        name: Transform data
        body: log('hello world')
        adaptor: "@openfn/language-common@latest"
        id: 8d627978-ebb9-4fb2-8cda-9b31c10c963e
        project_credential_id: null
    triggers:
      webhook:
        type: webhook
        enabled: true
        id: 7bb476cc-0292-4573-89d0-b13417bc648e
    edges:
      webhook->transform-data:
        id: 4c68d22a-4ba7-4d8f-8103-6f4f15c4e7d2
        target_job_id: 8d627978-ebb9-4fb2-8cda-9b31c10c963e
        enabled: true
        source_trigger_id: 7bb476cc-0292-4573-89d0-b13417bc648e
        condition_type: always
`;
const projectsPath = path.resolve(TMP_DIR);

test.before(async () => {
  // await rm(TMP_DIR, { recursive: true });
  await mkdir(`${TMP_DIR}/.projects`, { recursive: true });

  await writeFile(`${TMP_DIR}/openfn.yaml`, '');
  await writeFile(`${TMP_DIR}/.projects/main@app.openfn.org.yaml`, mainYaml);
  await writeFile(
    `${TMP_DIR}/.projects/staging@app.openfn.org.yaml`,
    stagingYaml
  );
});

test.serial('list available projects', async (t) => {
  const { stdout } = await run(`openfn projects -w ${projectsPath}`);

  t.regex(stdout, /hello-world/);
  t.regex(stdout, /8dbc4349-52b4-4bf2-be10-fdf06da52c46/);
  t.regex(stdout, /hello-world-staging/);
  t.regex(stdout, /5deddbfa-c63f-4dbc-98b5-a49d3395a488/);
});

// checkout a project from a yaml file
test.serial('Checkout a project', async (t) => {
  await run(`openfn checkout hello-world -w ${projectsPath}`);

  // check workflow.yaml
  const workflowYaml = await readFile(
    path.resolve(projectsPath, 'workflows/my-workflow/my-workflow.yaml'),
    'utf8'
  );
  t.is(
    workflowYaml,
    `id: my-workflow
name: my workflow
start: webhook
options: {}
steps:
  - id: webhook
    type: webhook
    enabled: true
    next:
      transform-data:
        disabled: false
        condition: always
  - id: transform-data
    name: Transform data
    adaptor: "@openfn/language-common@latest"
    expression: ./transform-data.js
`
  );

  const expr = await readFile(
    path.resolve(projectsPath, 'workflows/my-workflow/transform-data.js'),
    'utf8'
  );
  t.is(expr.trim(), 'fn(() => ({ x: 1}))');
});

// note: order of tests is important here
test.serial('execute a workflow from the checked out project', async (t) => {
  // cheeky bonus test of checkout by alias
  await run(`openfn checkout main -w ${projectsPath}`);

  // execute a workflow
  const { stdout } = await run(
    `openfn my-workflow  -o ${TMP_DIR}/output.json  --log debug --workspace ${projectsPath}`
  );
  const output = await readFile(`${TMP_DIR}/output.json`, 'utf8');
  const finalState = JSON.parse(output);
  t.deepEqual(finalState, { x: 1 });
});

// requires the prior test to run
test.serial('merge a project', async (t) => {
  // Checkout staging first (which has the code we want to merge in)
  await run(`openfn checkout hello-world-staging -w ${projectsPath}`);

  const readStep = () =>
    readFile(
      path.resolve(projectsPath, 'workflows/my-workflow/transform-data.js'),
      'utf8'
    ).then((str) => str.trim());

  // assert the initial step code in staging
  const initial = await readStep();
  t.is(initial, "log('hello world')");

  // Run the merge - merge checked-out staging into main
  await run(`openfn merge hello-world -w ${projectsPath} --force`);

  // Checkout main to verify the merge
  await run(`openfn checkout main -w ${projectsPath}`);

  // Check the step is updated in main
  const merged = await readStep();
  t.is(merged, "log('hello world')");
});
