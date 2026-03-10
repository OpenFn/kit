import { readFile, writeFile } from 'node:fs/promises';
import test from 'ava';
import mock from 'mock-fs';
import path from 'node:path';
import Project, { generateWorkflow } from '@openfn/project';
import { createMockLogger } from '@openfn/logger';
import createLightningServer from '@openfn/lightning-mock';

import {
  handler as deploy,
  hasRemoteDiverged,
  reportDiff,
} from '../../src/projects/deploy';
import { myProject_yaml, myProject_v1, UUID } from './fixtures';
import { checkout } from '../../src/projects';

let server: any;
const logger = createMockLogger(undefined, { level: 'debug' });
const port = 9876;
const ENDPOINT = `http://localhost:${port}`;

// quick fix to the fixture yaml, otherwise the deploy code kicks off
const projectYaml = myProject_yaml.replace('https://app.openfn.org', ENDPOINT);

const mockFs = (paths: Record<string, string>) => {
  const pnpm = path.resolve('../../node_modules/.pnpm');
  mock({
    [pnpm]: mock.load(pnpm, {}),
    ...paths,
  });
};

// Take a project yaml and expand it
// This uses checkout to do the heavy lifting
const setup = async (yaml: string = projectYaml) => {
  mockFs({
    '/ws/.projects/main@localhost.yaml': yaml,
    '/ws/openfn.yaml': '',
  });

  await checkout({
    project: 'main',
    workspace: '/ws',
  });
};

test.before(async () => {
  server = await createLightningServer({ port });
});

test.beforeEach(() => {
  server.reset();
  server.addProject(myProject_v1);
  logger._reset();
  mock.restore();
});

test.serial('deploy a new project', async (t) => {
  // the server should have 1 registered project by default - that's fine
  t.is(Object.keys(server.state.projects).length, 1);

  await setup();

  await deploy(
    {
      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
      new: true,
    } as any,
    logger
  );

  // We should now have a new project with a new UUID
  t.is(Object.keys(server.state.projects).length, 2);

  const success = logger._find('success', /Created new project at/);
  t.truthy(success);
});

test.serial('deploy a change to a project', async (t) => {
  t.truthy(server.state.projects[UUID]);
  t.is(Object.keys(server.state.projects).length, 1);

  await setup(projectYaml);

  // change the expression
  await writeFile('/ws/workflows/my-workflow/transform-data.js', 'log()');

  await deploy(
    {
      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
      log: 'debug',
      confirm: false,
    } as any,
    logger
  );
  const success = logger._find('success', /Updated project at/);
  t.truthy(success);

  // ensure that the project is now synced with lightning
  const transformData =
    server.state.projects[UUID].workflows['my-workflow'].jobs['transform-data'];

  t.is(transformData.body, 'log()');

  // Ensure no sneaky duplication
  t.truthy(server.state.projects[UUID]);
  t.is(Object.keys(server.state.projects).length, 1);
});

test.serial(
  'Error if the remote and local workflows have diverged',
  async (t) => {
    t.truthy(server.state.projects[UUID]);
    t.is(Object.keys(server.state.projects).length, 1);

    await setup(projectYaml);

    // change the local expression
    await writeFile('/ws/workflows/my-workflow/transform-data.js', 'log()');

    // change the server expression
    // (this will update the version hash in the mock)
    const modified = JSON.parse(
      JSON.stringify(server.state.projects[UUID].workflows['my-workflow'])
    );
    modified.jobs['transform-data'].body = 'each()';
    server.updateWorkflow(UUID, modified);

    await t.throwsAsync(
      () =>
        deploy(
          {
            endpoint: ENDPOINT,
            apiKey: 'test-api-key',
            workspace: '/ws',
            log: 'debug',
            confirm: false,
          } as any,
          logger
        ),
      {
        message: /PROJECTS_DIVERGED/,
      }
    );
    const warn = logger._find('warn', /workflows have diverged/i);
    t.truthy(warn);

    // the workflow should not have been edited (still has server state)
    const transformData =
      server.state.projects[UUID].workflows['my-workflow'].jobs[
        'transform-data'
      ];

    t.is(transformData.body, 'each()');
  }
);

// 1 project, 2 workflows
// change 1 locally
// only 1 should report a diff
// this is working fine locally.
test.serial.only('repro bug', async (t) => {
  t.truthy(server.state.projects[UUID]);
  t.is(Object.keys(server.state.projects).length, 1);

  // add a new remote workflow
  // server.updateWorkflow(UUID, {
  //   id: 'new-workflow',
  //   name: 'New Workflow',
  //   jobs: [
  //     {
  //       id: '6a850236-e90b-4cb0-a53a-3e1f17575930',
  //       name: 'My Job',
  //       body: 'fn(s => s)',
  //       adaptor: '@openfn/language-common@latest',
  //       project_credential_id: null,
  //     },
  //   ],
  //   triggers: [],
  //   edges: [],
  //   lock_version: 1,
  //   deleted_at: null,
  // });

  const newProject = projectYaml.replace(
    'workflows:',
    `workflows:
  - name: New Workflow
    steps:
      - id: my-job-1
        name:  My Job
        expression: fn(s => s)
        adaptor: "@openfn/language-common@latest"
`
  );
  await setup(newProject);

  // deploy once just to sync everything
  await deploy(
    {
      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
      confirm: false,
    } as any,
    logger
  );

  // now change the local expression in 1 workflow
  await writeFile('/ws/workflows/my-workflow/transform-data.js', 'log()');
  console.log(server.state.projects[UUID].workflows);
  // and change the other workflow remotely
  const [wf1, wf2] = Object.keys(server.state.projects[UUID].workflows);
  const modified = JSON.parse(
    JSON.stringify(server.state.projects[UUID].workflows[wf2])
  );
  modified.jobs['my-job-1'].body = 'each()';
  server.updateWorkflow(UUID, modified);

  // Now deploy the local changes
  await deploy(
    {
      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
      log: 'debug',
      confirm: false,
    } as any,
    logger
  );
  console.log(logger._history);

  const warn = logger._find('warn', /workflows have diverged/i);
  t.falsy(warn);

  // check the remote workflows are both correct
});

test('reportDiff: should report no changes for identical projects', (t) => {
  const wf = generateWorkflow('@id a trigger-x');

  const local = new Project({
    name: 'local',
    workflows: [wf],
  });

  const remote = new Project({
    name: 'remote',
    workflows: [wf],
  });

  const diffs = reportDiff(local, remote, [], logger);
  t.is(diffs.length, 0);

  const { message, level } = logger._parse(logger._last);
  t.is(level, 'info');
  t.is(message, 'No workflow changes detected');
});

test('reportDiff: should report changed workflow', (t) => {
  const wfRemote = generateWorkflow('@id a trigger-x');
  const wfLocal = generateWorkflow('@id a trigger-y');

  const local = new Project({
    name: 'local',
    workflows: [wfLocal],
  });

  const remote = new Project({
    name: 'remote',
    workflows: [wfRemote],
  });

  const diffs = reportDiff(local, remote, [], logger);
  t.is(diffs.length, 1);
  t.deepEqual(diffs[0], { id: 'a', type: 'changed' });

  t.truthy(logger._find('always', /workflows modified/i));
  t.truthy(logger._find('always', /- a/i));
});

test('reportDiff: should report added workflow', (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');

  const local = new Project({
    name: 'local',
    workflows: [wf1, wf2],
  });

  const remote = new Project({
    name: 'remote',
    workflows: [wf1],
  });

  const diffs = reportDiff(local, remote, [], logger);
  t.is(diffs.length, 1);
  t.deepEqual(diffs[0], { id: 'b', type: 'added' });

  t.truthy(logger._find('always', /workflows added/i));
  t.truthy(logger._find('always', /- b/i));
});

test('reportDiff: should report removed workflow', (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');

  const local = new Project({
    name: 'local',
    workflows: [wf1],
  });

  const remote = new Project({
    name: 'remote',
    workflows: [wf1, wf2],
  });

  const diffs = reportDiff(local, remote, [], logger);
  t.is(diffs.length, 1);
  t.deepEqual(diffs[0], { id: 'b', type: 'removed' });

  t.truthy(logger._find('always', /workflows removed/i));
  t.truthy(logger._find('always', /- b/i));
});

test('reportDiff: should report mix of added, changed, and removed workflows', (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2Remote = generateWorkflow('@id b trigger-y');
  const wf2Local = generateWorkflow('@id b trigger-different');
  const wf3 = generateWorkflow('@id c trigger-z');
  const wf4 = generateWorkflow('@id d trigger-w');

  const local = new Project({
    name: 'local',
    workflows: [wf1, wf2Local, wf4], // has a, b (changed), d (new)
  });

  const remote = new Project({
    name: 'remote',
    workflows: [wf1, wf2Remote, wf3], // has a, b, c
  });

  const diffs = reportDiff(local, remote, [], logger);
  t.is(diffs.length, 3);

  t.deepEqual(
    diffs.find((d) => d.id === 'b'),
    { id: 'b', type: 'changed' }
  );
  t.deepEqual(
    diffs.find((d) => d.id === 'c'),
    { id: 'c', type: 'removed' }
  );
  t.deepEqual(
    diffs.find((d) => d.id === 'd'),
    { id: 'd', type: 'added' }
  );

  t.truthy(logger._find('always', /workflows added/i));
  t.truthy(logger._find('always', /- d/i));
  t.truthy(logger._find('always', /workflows modified/i));
  t.truthy(logger._find('always', /- b/i));
  t.truthy(logger._find('always', /workflows removed/i));
  t.truthy(logger._find('always', /- c/i));
});

// TODO skipping while history checking is messed up
test.serial.skip(
  'Exit early if the remote is not compatible with local',
  async (t) => {
    mockFs({
      '/ws/.projects/main@app.openfn.org.yaml': projectYaml,
      '/ws/openfn.yaml': '',
    });

    // Update the server-side project
    const changed = JSON.parse(JSON.stringify(myProject_v1));
    changed.workflows['my-workflow'].version_history.push('app:abc');

    server.addProject('e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00', changed);

    // checkout the project locally
    await checkout(
      {
        project: 'main',
        workspace: '/ws',
      },
      logger
    );

    // Now change the expression
    await writeFile('/ws/workflows/my-workflow/transform-data.js', 'log()');

    await deploy(
      {
        endpoint: ENDPOINT,
        apiKey: 'test-api-key',
        workspace: '/ws',
      } as any,
      logger
    );

    // The remote project should not have changed
    const appState =
      server.state.projects['e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00'];
    t.deepEqual(appState, myProject_v1);

    // We should log what's going on to the user
    const expectedLog = logger._find('error', /projects have diverged/i);
    t.truthy(expectedLog);
  }
);

test('hasRemoteDiverged: 1 workflow, no diverged', (t) => {
  const local = {
    workflows: [
      {
        id: 'w',
      },
    ],
    cli: {
      forked_from: {
        w: 'a',
      },
    },
  } as unknown as Project;

  const remote = {
    getWorkflow: () => ({
      id: 'w',
      history: ['a'],
    }),
  } as unknown as Project;

  const diverged = hasRemoteDiverged(local, remote);
  t.falsy(diverged);
});

test('hasRemoteDiverged: 1 workflow, 1 diverged', (t) => {
  const local = {
    workflows: [
      {
        id: 'w',
      },
    ],
    cli: {
      forked_from: {
        w: 'w',
      },
    },
  } as unknown as Project;

  const remote = {
    getWorkflow: () => ({
      id: 'w',
      history: ['a', 'b'],
    }),
  } as unknown as Project;

  const diverged = hasRemoteDiverged(local, remote);
  t.deepEqual(diverged, ['w']);
});
