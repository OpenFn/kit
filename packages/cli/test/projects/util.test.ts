import test from 'ava';
import fs from 'node:fs';
import mock from 'mock-fs';
import Project, { generateWorkflow, yamlToJson } from '@openfn/project';
import {
  findLocallyChangedWorkflows,
  tidyWorkflowDir,
  writeCheckoutFile,
  ensureCheckoutIgnored,
} from '../../src/projects/util';

test.afterEach(() => {
  mock.restore();
});

test('tidyWorkflowDir: removes workflows that no longer exist', async (t) => {
  const currentProject = new Project({
    name: 'current',
    workflows: [
      generateWorkflow('@id A trigger-x'),
      generateWorkflow('@id B trigger-y'),
    ],
  });

  const incomingProject = new Project({
    name: 'incoming',
    workflows: [
      generateWorkflow('@id A trigger-x'),
      generateWorkflow('@id D trigger-w'),
    ],
  });

  const toRemove = await tidyWorkflowDir(currentProject, incomingProject, true);

  t.deepEqual(toRemove, ['workflows/B/B.yaml']);
});

test('tidyWorkflowDir: do nothing when no workflows are removed', async (t) => {
  const currentProject = new Project({
    name: 'current',
    workflows: [generateWorkflow('@id A trigger-x')],
  });

  const incomingProject = new Project({
    name: 'incoming',
    workflows: [
      generateWorkflow('@id A trigger-x'),
      generateWorkflow('@id B trigger-y'),
    ],
  });

  const toRemove = await tidyWorkflowDir(currentProject, incomingProject, true);

  t.deepEqual(toRemove, []);
});

test('tidyWorkflowDir: removes all workflows when incoming project is empty', async (t) => {
  const currentProject = new Project({
    name: 'current',
    workflows: [
      generateWorkflow('@id A trigger-x'),
      generateWorkflow('@id B trigger-y'),
    ],
  });

  const incomingProject = new Project({
    name: 'incoming',
    workflows: [],
  });

  const toRemove = await tidyWorkflowDir(currentProject, incomingProject, true);

  // All workflows should be removed
  t.deepEqual(toRemove, ['workflows/A/A.yaml', 'workflows/B/B.yaml']);
});

test('tidyWorkflowDir: both projects empty', async (t) => {
  const currentProject = new Project({
    name: 'current',
    workflows: [],
  });

  const incomingProject = new Project({
    name: 'incoming',
    workflows: [],
  });

  const toRemove = await tidyWorkflowDir(currentProject, incomingProject, true);

  t.deepEqual(toRemove, []);
});

test('tidyWorkflowDir: identical projects', async (t) => {
  const currentProject = new Project({
    name: 'current',
    workflows: [
      generateWorkflow('@id A trigger-x'),
      generateWorkflow('@id B trigger-y'),
    ],
  });

  const incomingProject = new Project({
    name: 'incoming',
    workflows: [
      generateWorkflow('@id A trigger-x'),
      generateWorkflow('@id B trigger-y'),
    ],
  });

  const toRemove = await tidyWorkflowDir(currentProject, incomingProject, true);

  t.deepEqual(toRemove, []);
});

test('tidyWorkflowDir: complete replacement with no overlap', async (t) => {
  const currentProject = new Project({
    name: 'current',
    workflows: [
      generateWorkflow('@id A trigger-x'),
      generateWorkflow('@id B trigger-y'),
    ],
  });

  const incomingProject = new Project({
    name: 'incoming',
    workflows: [
      generateWorkflow('@id X trigger-x'),
      generateWorkflow('@id Y trigger-y'),
    ],
  });

  const toRemove = await tidyWorkflowDir(currentProject, incomingProject, true);

  t.deepEqual(toRemove, ['workflows/A/A.yaml', 'workflows/B/B.yaml']);
});

test('tidyWorkflowDir: handles undefined projects', async (t) => {
  const project = new Project({
    name: 'project',
    workflows: [generateWorkflow('@id A trigger-x')],
  });

  // Both undefined
  let toRemove = await tidyWorkflowDir(undefined, undefined, true);
  t.deepEqual(toRemove, []);

  // Current undefined
  toRemove = await tidyWorkflowDir(undefined, project, true);
  t.deepEqual(toRemove, []);

  // Incoming undefined
  toRemove = await tidyWorkflowDir(project, undefined, true);
  t.deepEqual(toRemove, []);
});

test('tidyWorkflowDir: removes expression files when workflow steps change', async (t) => {
  const currentProject = new Project({
    name: 'current',
    workflows: [generateWorkflow('@id A trigger-x(expression=fn)')],
  });

  const incomingProject = new Project({
    name: 'incoming',
    workflows: [generateWorkflow('@id A trigger-z(expression=fn)')],
  });

  const toRemove = await tidyWorkflowDir(currentProject, incomingProject, true);

  t.deepEqual(toRemove, ['workflows/A/x.js']);
});

test('findLocallyChangedWorkflows: no changed workflows', async (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');

  const hash1 = wf1.getVersionHash();
  const hash2 = wf2.getVersionHash();

  const project = new Project({
    name: 'test',
    workflows: [wf1, wf2],
  });

  // Create a mock workspace with forked_from that matches current hashes
  const workspace = {
    activeProject: {
      forked_from: {
        a: hash1,
        b: hash2,
      },
    },
  } as any;

  const changed = await findLocallyChangedWorkflows(workspace, project);
  t.deepEqual(changed, []);
});

test('findLocallyChangedWorkflows: all workflows changed if there is no forked_from', async (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');

  const project = new Project({
    name: 'test',
    workflows: [wf1, wf2],
  });

  // Create a mock workspace with NO forked_from
  const workspace = {
    activeProject: {},
  } as any;

  const changed = await findLocallyChangedWorkflows(workspace, project);
  t.deepEqual(changed, ['a', 'b']);
});

test('findLocallyChangedWorkflows: detect 1 locally changed workflow', async (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-z');

  const workspace = {
    activeProject: {
      forked_from: {
        a: wf1.getVersionHash(),
        b: wf2.getVersionHash(),
      },
    },
  } as any;

  const project = new Project({
    name: 'test',
    workflows: [wf1, wf2],
  });

  project.workflows[0].name = 'changed';

  const changed = await findLocallyChangedWorkflows(workspace, project);
  t.deepEqual(changed, ['a']);
});

test('findLocallyChangedWorkflows: detect 1 locally added workflow', async (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');

  const workspace = {
    activeProject: {
      forked_from: {
        a: wf1.getVersionHash(),
      },
    },
  } as any;

  const project = new Project({
    name: 'test',
    workflows: [wf1, wf2],
  });

  const changed = await findLocallyChangedWorkflows(workspace, project);
  t.deepEqual(changed, ['b']);
});

test('findLocallyChangedWorkflows: detect 1 locally removed workflow', async (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');

  const workspace = {
    activeProject: {
      forked_from: {
        a: wf1.getVersionHash(),
        b: wf2.getVersionHash(),
      },
    },
  } as any;

  const project = new Project({
    name: 'test',
    workflows: [wf1],
  });

  const changed = await findLocallyChangedWorkflows(workspace, project);
  t.deepEqual(changed, ['b']);
});

const trackedProject = () =>
  new Project({
    id: 'my-project',
    name: 'My Project',
    openfn: { uuid: 'abcd', endpoint: 'https://app.openfn.org' },
    workflows: [
      { id: 'wf', name: 'wf', history: ['old', 'latest'], steps: [] },
    ],
  });

test.serial(
  'writeCheckoutFile: writes the project meta and forked_from to the checkout file',
  async (t) => {
    mock({ '/ws': {} });

    const filePath = await writeCheckoutFile('/ws', trackedProject());

    t.is(filePath, '/ws/.openfn/checkout.yaml');
    t.deepEqual(yamlToJson(fs.readFileSync(filePath, 'utf8')), {
      alias: 'main',
      endpoint: 'https://app.openfn.org',
      forked_from: { wf: 'latest' },
      id: 'my-project',
      name: 'My Project',
      uuid: 'abcd',
    });
  }
);

test.serial(
  'writeCheckoutFile: writes to the checkout file for a branch',
  async (t) => {
    mock({ '/ws': {} });

    const filePath = await writeCheckoutFile('/ws', trackedProject(), 'dev');

    t.is(filePath, '/ws/.openfn/branches/dev/checkout.yaml');
    t.true(fs.existsSync(filePath));
    t.false(fs.existsSync('/ws/.openfn/checkout.yaml'));
  }
);

test.serial(
  'writeCheckoutFile: does not touch the workspace config or workflows',
  async (t) => {
    mock({
      '/ws/openfn.yaml': 'credentials: creds.yaml',
      '/ws/workflows/wf/wf.yaml': 'id: wf',
    });

    await writeCheckoutFile('/ws', trackedProject());

    t.deepEqual(fs.readdirSync('/ws').sort(), [
      '.openfn',
      'openfn.yaml',
      'workflows',
    ]);
    t.is(fs.readFileSync('/ws/openfn.yaml', 'utf8'), 'credentials: creds.yaml');
    t.is(fs.readFileSync('/ws/workflows/wf/wf.yaml', 'utf8'), 'id: wf');
    t.deepEqual(fs.readdirSync('/ws/workflows/wf'), ['wf.yaml']);
  }
);

test.serial(
  'ensureCheckoutIgnored: makes git ignore everything in .openfn',
  async (t) => {
    mock({ '/ws': {} });

    await ensureCheckoutIgnored('/ws');

    t.is(fs.readFileSync('/ws/.openfn/.gitignore', 'utf8'), '*\n');
  }
);

test.serial(
  'ensureCheckoutIgnored: leaves an existing .gitignore alone',
  async (t) => {
    mock({ '/ws/.openfn/.gitignore': 'custom\n' });

    await ensureCheckoutIgnored('/ws');

    t.is(fs.readFileSync('/ws/.openfn/.gitignore', 'utf8'), 'custom\n');
  }
);

test.serial(
  'ensureCheckoutIgnored: does nothing if OPENFN_IGNORE_CHECKOUT_META is set',
  async (t) => {
    mock({ '/ws': {} });
    process.env.OPENFN_IGNORE_CHECKOUT_META = 'true';

    try {
      await ensureCheckoutIgnored('/ws');
    } finally {
      delete process.env.OPENFN_IGNORE_CHECKOUT_META;
    }

    t.false(fs.existsSync('/ws/.openfn'));
  }
);

test.serial(
  'writeCheckoutFile: makes git ignore the checkout state',
  async (t) => {
    mock({ '/ws': {} });

    await writeCheckoutFile('/ws', trackedProject());

    t.is(fs.readFileSync('/ws/.openfn/.gitignore', 'utf8'), '*\n');
  }
);
