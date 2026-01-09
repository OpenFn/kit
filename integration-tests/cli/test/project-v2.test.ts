import test from 'ava';
import { rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import run from '../src/run';

const mainYaml = `
id: sandboxing-simple
name: Sandboxing Simple
version: 2
collections: []
credentials:
  - id: 10a50683-78b0-4ddf-9c14-23a1fb21074a
    name: name
    owner: editor@openfn.org
openfn:
  uuid: a272a529-716a-4de7-a01c-a082916c6d23
  endpoint: http://localhost:4000
  env: project
  fetched_at: 2025-11-26T17:55:09.716Z
  inserted_at: 2025-10-17T10:30:44Z
  updated_at: 2025-10-24T14:52:13Z
options:
  env: main
  allow_support_access: false
  requires_mfa: false
  retention_policy: retain_all
workflows:
  - name: Hello Workflow
    start: trigger
    steps:
      - id: trigger
        type: webhook
        openfn:
          enabled: true
          uuid: 9c0a4e8a-b82f-4fa5-8d12-419da143cd04
        next:
          transform-data:
            disabled: false
            condition: true
            openfn:
              uuid: add150e9-8616-48ca-844e-8aaa489c7a10
      - id: transform-data
        name: Transform data
        expression: |
          fn(() => ({ x: 1}))
        adaptor: "@openfn/language-dhis2@8.0.4"
        openfn:
          uuid: a9f64216-7974-469d-8415-d6d9baf2f92e
          project_credential_id: null
    openfn:
      uuid: af697653-98d2-46e4-912f-e1cb6bf8f4b4
      concurrency: 5
      inserted_at: 2025-10-17T10:30:51Z
      updated_at: 2025-10-24T14:52:13Z
      deleted_at: null
      lock_version: 16
    id: hello-workflow
    history: []
`;

const stagingYaml = `id: staging
name: staging
version: 2
collections: []
credentials:
  - id: 07c0baa7-c1d7-44b2-abb6-3446defbe3e3
    name: name
    owner: editor@openfn.org
openfn:
  uuid: bc6629fb-7dc8-4b28-93af-901e2bd58dc4
  endpoint: http://localhost:4000
  env: staging
  fetched_at: 2025-11-27T11:40:37.670Z
  inserted_at: 2025-11-27T11:39:33Z
  updated_at: 2025-11-27T11:39:33Z
options:
  env: main
  color: "#F39B33"
  parent_id: a272a529-716a-4de7-a01c-a082916c6d23
  allow_support_access: false
  requires_mfa: false
  retention_policy: retain_all
workflows:
  - name: Hello Workflow
    start: trigger
    steps:
      - id: trigger
        type: webhook
        openfn:
          enabled: false
          uuid: 9ef55dca-16a3-480c-a807-2d37744e6e53
        next:
          transform-data:
            disabled: false
            condition: true
            openfn:
              uuid: f34146b5-de43-4b05-ac00-3b4f327e62ec
      - id: transform-data
        name: Transform data
        expression: |
          fn()
        adaptor: "@openfn/language-dhis2@8.0.4"
        openfn:
          uuid: 5b4c74f9-76ac-4715-bd45-04b130ca549c
          project_credential_id: null
     
    openfn:
      uuid: 10ce2914-16aa-4e00-b746-47678b1c60d4
      concurrency: 5
      inserted_at: 2025-11-27T11:39:33Z
      updated_at: 2025-11-27T11:39:47Z
      deleted_at: null
      lock_version: 1
    id: hello-workflow
    history: []
`;
const projectsPath = path.resolve('tmp/project');

test.before(async () => {
  await rm('tmp/project', { recursive: true });
  await mkdir('tmp/project/.projects', { recursive: true });

  await writeFile('tmp/project/openfn.yaml', '');
  await writeFile('tmp/project/.projects/main@app.openfn.org.yaml', mainYaml);
  await writeFile(
    'tmp/project/.projects/staging@app.openfn.org.yaml',
    stagingYaml
  );
});

test.serial('list available projects', async (t) => {
  const { stdout } = await run(`openfn projects -w ${projectsPath}`);
  t.regex(stdout, /sandboxing-simple/);
  t.regex(stdout, /a272a529-716a-4de7-a01c-a082916c6d23/);
  t.regex(stdout, /staging/);
  t.regex(stdout, /bc6629fb-7dc8-4b28-93af-901e2bd58dc4/);
});

test.serial('Checkout a project', async (t) => {
  await run(`openfn checkout staging -w ${projectsPath}`);

  // check workflow.yaml
  const workflowYaml = await readFile(
    path.resolve(projectsPath, 'workflows/hello-workflow/hello-workflow.yaml'),
    'utf8'
  );
  t.is(
    workflowYaml,
    `id: hello-workflow
name: Hello Workflow
start: trigger
options: {}
steps:
  - id: trigger
    type: webhook
    next:
      transform-data:
        disabled: false
        condition: true
  - id: transform-data
    name: Transform data
    adaptor: "@openfn/language-dhis2@8.0.4"
    expression: ./transform-data.js
`
  );

  const expr = await readFile(
    path.resolve(projectsPath, 'workflows/hello-workflow/transform-data.js'),
    'utf8'
  );
  t.is(expr.trim(), 'fn()');
});

// requires the prior test to run
test.serial('merge a project', async (t) => {
  const readStep = () =>
    readFile(
      path.resolve(projectsPath, 'workflows/hello-workflow/transform-data.js'),
      'utf8'
    ).then((str) => str.trim());

  // assert the initial step code
  const initial = await readStep();
  t.is(initial, '// TODO');

  // Run the merge
  const { stdout } = await run(
    `openfn merge staging -w ${projectsPath} --force`
  );

  // Check the step is updated
  const merged = await readStep();
  t.is(merged, 'fn()');
});

test.serial('execute a workflow from the checked out project', async (t) => {
  // cheeky bonus test of checkout by alias
  await run(`openfn checkout main --log debug -w ${projectsPath}`);

  // execute a workflow
  await run(
    `openfn hello-workflow  -o /tmp/output.json  --workspace ${projectsPath}`
  );

  const output = await readFile('/tmp/output.json', 'utf8');
  const finalState = JSON.parse(output);
  t.deepEqual(finalState, { x: 1 });
});
