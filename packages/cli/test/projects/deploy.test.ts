import { readFile, writeFile } from 'node:fs/promises';
import test from 'ava';
import mock from 'mock-fs';
import path from 'node:path';
import Project, { generateWorkflow } from '@openfn/project';
import { createMockLogger } from '@openfn/logger';
import createLightningServer, {
  DEFAULT_PROJECT_ID,
} from '@openfn/lightning-mock';

import {
  handler as deployHandler,
  reportDiff,
} from '../../src/projects/deploy';
import { myProject_yaml, myProject_v1 } from './fixtures';
import { checkout } from '../../src/projects';

const logger = createMockLogger(undefined, { level: 'debug' });

const port = 9876;
const ENDPOINT = `http://localhost:${port}`;

let server: any;

test.before(async () => {
  server = await createLightningServer({ port });
});

test.beforeEach(() => {
  server.addProject(myProject_v1);
  logger._reset();
});

// what will deploy tests look like?

// deploy a project for the first time (this doesn't work though?)

// deploy a change to a project

// deploy a change to a project but fetch latest first

// throw when trying to deploy to a diverged remote project

// force deploy an incompatible project

// don't post the final version if dry-run is set

// TODO diff + confirm

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

  const diffs = reportDiff(local, remote, logger);
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

  const diffs = reportDiff(local, remote, logger);
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

  const diffs = reportDiff(local, remote, logger);
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

  const diffs = reportDiff(local, remote, logger);
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

  const diffs = reportDiff(local, remote, logger);
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

test.serial.only(
  'deploy a change to a project and write the yaml back',
  async (t) => {
    // Mock the filesystem
    mock({
      '/ws/.projects/main@test.yaml': myProject_yaml,
      '/ws/openfn.yaml': '',
    });

    // first checkout the project
    await checkout(
      {
        project: 'main',
        workspace: '/ws',
      },
      logger
    );

    // Now change the expression
    await writeFile('/ws/workflows/my-workflow/transform-data.js', 'log()');

    // TODO by testing deploy like a closed box like, and with the lightning mock,
    // it's hard to see what is actually sent
    // but its my mock, it should be able to help with this!
    await deployHandler(
      {
        endpoint: ENDPOINT,
        apiKey: 'test-api-key',
        workspace: '/ws',
        force: true, // TODO hoping to remove this soon
      } as any,
      logger
    );
    console.log(logger._history.map((l) => l.at(-1)));

    const expected = myProject_yaml.replace('fn()', 'log()');
    const projectYaml = await readFile('/ws/.projects/main@test.yaml', 'utf8');
    t.is(projectYaml, expected);

    const success = logger._find('success', /Updated project at/);
    t.truthy(success);
  }
);
