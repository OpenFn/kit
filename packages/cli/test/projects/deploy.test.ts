import { writeFile } from 'node:fs/promises';
import test from 'ava';
import mock from 'mock-fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import Project, {
  generateWorkflow,
  jsonToYaml,
  yamlToJson,
} from '@openfn/project';
import { createMockLogger } from '@openfn/logger';
import createLightningServer from '@openfn/lightning-mock';

import {
  handler as deploy,
  hasRemoteDiverged,
  collectionsChanged,
  deletedCollections,
} from '../../src/projects/deploy';
import { printRichDiff } from '../../src/projects/diff';
import {
  myProject_yaml,
  myProject_v1,
  UUID,
  two_workflows_yaml as twowfs,
  TWO_WORKFLOWS_UUID,
} from './fixtures';
import { checkout } from '../../src/projects';

let server: any;
const logger = createMockLogger(undefined, { level: 'debug' });
const port = 9876;
const ENDPOINT = `http://localhost:${port}`;

// quick fix to the fixture yaml, otherwise the deploy code kicks off
const projectYaml = myProject_yaml.replace('https://app.openfn.org', ENDPOINT);
const two_workflows_yaml = twowfs.replace('https://app.openfn.org', ENDPOINT);

const require = createRequire(import.meta.url);

const mockFs = (paths: Record<string, string>) => {
  // ensure this path is available to pnpm (needed by deps for some reason??)
  // Note: loading all of pnpm takes ~7 seconds per test
  // this workaround cuts out that delay entirely
  const iconv = path.resolve(
    '../../node_modules/.pnpm/iconv-lite@0.4.24/node_modules/iconv-lite/encodings'
  );
  // undici v8 reads its llhttp WASM from disk on the first request, so keep
  // that dir visible or fetches to the mock server fail with ENOENT
  const undiciLlhttp = path.join(
    path.dirname(require.resolve('undici')),
    'lib/llhttp'
  );
  mock({
    [iconv]: mock.load(iconv, {}),
    [undiciLlhttp]: mock.load(undiciLlhttp, {}),
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

test.serial('deploy a new project creates ids for collections', async (t) => {
  const yamlWithCollections = projectYaml.replace(
    'collections: []',
    'collections:\n  - name: my-collection'
  );

  await setup(yamlWithCollections);

  await deploy(
    {
      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
      new: true,
    } as any,
    logger
  );

  const newProjectId = Object.keys(server.state.projects).find(
    (id) => id !== UUID
  )!;
  const created: any = server.state.projects[newProjectId];

  t.is(created.collections.length, 1);
  t.is(created.collections[0].name, 'my-collection');
  t.truthy(created.collections[0].id);
  t.falsy(created.collections[0].delete);
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

test.serial(
  'Passing --workflow only updates the requested workflows',
  async (t) => {
    await server.addProject(two_workflows_yaml);
    await setup(two_workflows_yaml);

    // Change both workflows locally
    await writeFile('/ws/workflows/workflow-a/job-a.js', 'modifiedA()');
    await writeFile('/ws/workflows/workflow-b/job-b.js', 'modifiedB()');

    await deploy(
      {
        endpoint: ENDPOINT,
        apiKey: 'test-api-key',
        workspace: '/ws',
        confirm: false,
        workflow: ['workflow-a'],
      } as any,
      logger
    );

    const remoteProject = server.state.projects[TWO_WORKFLOWS_UUID];
    t.is(
      remoteProject.workflows['workflow-a'].jobs['job-a'].body,
      'modifiedA()'
    );
    t.is(remoteProject.workflows['workflow-b'].jobs['job-b'].body, 'fn()');
  }
);

test.serial(
  '--workflow errors when an id is not in the local project',
  async (t) => {
    await setup(projectYaml);

    await t.throwsAsync(
      () =>
        deploy(
          {
            endpoint: ENDPOINT,
            apiKey: 'test-api-key',
            workspace: '/ws',
            confirm: false,
            workflow: ['nope-not-a-real-workflow'],
          } as any,
          logger
        ),
      { message: /nope-not-a-real-workflow/ }
    );
  }
);

test.serial.only(
  'deploy: syncs a collections-only change with no workflow changes',
  async (t) => {
    // live server state: two existing collections
    await server.addProject({
      ...myProject_v1,
      collections: [
        { id: 'coll-1', name: 'keep-me' },
        { id: 'coll-2', name: 'remove-me' },
      ],
    });

    await setup(projectYaml);

    // user hand-edits openfn.yaml: keep one, drop one, add a new one -
    // no workflow files are touched
    const openfn: any = yamlToJson(fs.readFileSync('/ws/openfn.yaml', 'utf8'));
    openfn.project.collections = ['keep-me', 'new-collection'];
    await writeFile('/ws/openfn.yaml', jsonToYaml(openfn));

    await deploy(
      {
        endpoint: ENDPOINT,
        apiKey: 'test-api-key',
        workspace: '/ws',
        confirm: false,
      } as any,
      logger
    );

    // a collections-only edit must not be treated as "nothing to deploy"
    t.falsy(logger._find('success', /Nothing to deploy/));
    t.truthy(logger._find('success', /Updated project at/));

    const remoteCollections = server.state.projects[UUID].collections;
    t.is(remoteCollections.length, 2);
    t.deepEqual(remoteCollections[0], { id: 'coll-1', name: 'keep-me' });
    t.is(remoteCollections[1].name, 'new-collection');

    const created = remoteCollections.find(
      (c: any) => c.name === 'new-collection'
    );
    t.truthy(created?.id);
    t.falsy(created?.delete);
  }
);

test.serial(
  '--workflow only actually updates a workflow if it has changed',
  async (t) => {
    t.truthy(server.state.projects[UUID]);
    await setup(projectYaml);

    await deploy(
      {
        endpoint: ENDPOINT,
        apiKey: 'test-api-key',
        workspace: '/ws',
        confirm: false,
        workflow: ['my-workflow'],
      } as any,
      logger
    );

    // TODO better to check that there is no post request tbh
    t.truthy(logger._find('success', /Nothing to deploy/));
  }
);

test.serial(
  '--workflow will overwrite a newer version on the target if --force is included',
  async (t) => {
    t.truthy(server.state.projects[UUID]);
    await setup(projectYaml);

    // Assert that the original remote code is fn()
    const ogTransformData =
      server.state.projects[UUID].workflows['my-workflow'].jobs[
        'transform-data'
      ];
    t.is(ogTransformData.body, 'fn()');

    // Modify the remote
    const modified = JSON.parse(
      JSON.stringify(server.state.projects[UUID].workflows['my-workflow'])
    );
    modified.jobs['transform-data'].body = 'each()';
    server.updateWorkflow(UUID, modified);

    const changedTransformData =
      server.state.projects[UUID].workflows['my-workflow'].jobs[
        'transform-data'
      ];
    t.is(changedTransformData.body, 'each()');

    // Force push local (which will revert the remote changed)
    await deploy(
      {
        endpoint: ENDPOINT,
        apiKey: 'test-api-key',
        workspace: '/ws',
        confirm: false,
        workflow: ['my-workflow'],
        force: true,
      } as any,
      logger
    );

    t.truthy(logger._find('success', /Updated project at/));

    // The remote should have been overwritten with the local body
    const mergedTransformData =
      server.state.projects[UUID].workflows['my-workflow'].jobs[
        'transform-data'
      ];
    t.is(mergedTransformData.body, 'fn()');
  }
);

test.serial(
  '--workflow still errors on divergence without --force',
  async (t) => {
    await setup(projectYaml);

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
            confirm: false,
            workflow: ['my-workflow'],
          } as any,
          logger
        ),
      { message: /PROJECTS_DIVERGED/ }
    );
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

test('collectionsChanged: false when the same names are on both sides', (t) => {
  const local = {
    collections: [{ name: 'a' }, { name: 'b' }],
  } as unknown as Project;
  const remote = {
    collections: [
      { uuid: 'uuid-a', name: 'a' },
      { uuid: 'uuid-b', name: 'b' },
    ],
  } as unknown as Project;

  t.false(collectionsChanged(local, remote));
});

test('collectionsChanged: true when a name was added locally', (t) => {
  const local = {
    collections: [{ name: 'a' }, { name: 'b' }],
  } as unknown as Project;
  const remote = {
    collections: [{ uuid: 'uuid-a', name: 'a' }],
  } as unknown as Project;

  t.true(collectionsChanged(local, remote));
});

test('collectionsChanged: true when a name was removed locally', (t) => {
  const local = {
    collections: [{ name: 'a' }],
  } as unknown as Project;
  const remote = {
    collections: [
      { uuid: 'uuid-a', name: 'a' },
      { uuid: 'uuid-b', name: 'b' },
    ],
  } as unknown as Project;

  t.true(collectionsChanged(local, remote));
});

test('deletedCollections: flags a remote name missing from the merged project', (t) => {
  const merged = {
    collections: [{ name: 'keep-me' }],
  } as unknown as Project;
  const remote = {
    collections: [
      { uuid: 'uuid-keep', name: 'keep-me' },
      { uuid: 'uuid-remove', name: 'remove-me' },
    ],
  } as unknown as Project;

  t.deepEqual(deletedCollections(merged, remote), [
    { id: 'uuid-remove', name: 'remove-me', delete: true },
  ]);
});

test('deletedCollections: nothing to delete when every remote name survives', (t) => {
  const merged = {
    collections: [{ name: 'a' }, { name: 'b' }],
  } as unknown as Project;
  const remote = {
    collections: [
      { uuid: 'uuid-a', name: 'a' },
      { uuid: 'uuid-b', name: 'b' },
    ],
  } as unknown as Project;

  t.deepEqual(deletedCollections(merged, remote), []);
});
