import { writeFile } from 'node:fs/promises';
import test from 'ava';
import mock from 'mock-fs';
import path from 'node:path';
import Project, { generateWorkflow } from '@openfn/project';
import { createMockLogger } from '@openfn/logger';
import createLightningServer from '@openfn/lightning-mock';

import {
  handler as deploy,
  hasRemoteDiverged,
} from '../../src/projects/deploy';
import { printRichDiff } from '../../src/projects/diff';
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

// TODO in this case, should we warn the user of any workflows that have changed remotely?
// Offer to update locally?
test.serial(
  'When running deploy with no changes locally, but changes remotely, do not warn diffs',
  async (t) => {
    t.truthy(server.state.projects[UUID]);
    t.is(Object.keys(server.state.projects).length, 1);

    await setup(projectYaml);

    const modified = JSON.parse(
      JSON.stringify(server.state.projects[UUID].workflows['my-workflow'])
    );
    modified.jobs['transform-data'].body = 'each()';
    server.updateWorkflow(UUID, modified);

    // Run deploy, even though nothing changed locally
    await deploy(
      {
        endpoint: ENDPOINT,
        apiKey: 'test-api-key',
        workspace: '/ws',
        confirm: false,
      } as any,
      logger
    );

    const warn = logger._find('warn', /workflows have diverged/i);
    t.falsy(warn);

    const noop = logger._find('success', /Nothing to deploy/i);
    t.truthy(noop);
  }
);

test('printRichDiff: should report no changes for identical projects', (t) => {
  const wf = generateWorkflow('@id a trigger-x');

  const local = new Project({
    name: 'local',
    workflows: [wf],
  });

  const remote = new Project({
    name: 'remote',
    workflows: [wf],
  });

  const diffs = printRichDiff(local, remote, [], logger);
  t.is(diffs.length, 0);

  const { message, level } = logger._parse(logger._last);
  t.is(level, 'info');
  t.is(message, 'No workflow changes detected');
});

test('printRichDiff: should report changed workflow', (t) => {
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

  const diffs = printRichDiff(local, remote, [], logger);
  t.is(diffs.length, 1);
  t.deepEqual(diffs[0], { id: 'a', type: 'changed' });

  t.truthy(logger._find('always', /: changed/i));
});

test('printRichDiff: should report added workflow', (t) => {
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

  const diffs = printRichDiff(local, remote, [], logger);
  t.is(diffs.length, 1);
  t.deepEqual(diffs[0], { id: 'b', type: 'added' });

  t.truthy(logger._find('always', /: added/i));
});

test('printRichDiff: should report removed workflow', (t) => {
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

  const diffs = printRichDiff(local, remote, [], logger);
  t.is(diffs.length, 1);
  t.deepEqual(diffs[0], { id: 'b', type: 'removed' });

  t.truthy(logger._find('always', /: deleted/i));
});

test('printRichDiff: should report mix of added, changed, and removed workflows', (t) => {
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

  const diffs = printRichDiff(local, remote, [], logger);
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

  t.truthy(logger._find('always', /: added/i));
  t.truthy(logger._find('always', /: changed/i));
  t.truthy(logger._find('always', /: deleted/i));
});

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
