import test from 'ava';
import { Project } from '../../src/Project';
import toFs, { extractWorkflow } from '../../src/serialize/to-fs';
import { yamlToJson } from '../../src/util/yaml';

const step = {
  id: 'step',
  expression: 'fn(s => s)',
  adaptor: '@openfn/language-common@latest',
  openfn: {
    id: '66add020-e6eb-4eec-836b-20008afca816',
  },
};

test('extractWorkflow: single simple workflow (yaml by default)', (t) => {
  const project = new Project({
    workflows: [
      {
        // TODO I need to fix  this name/id conflict
        // the local workflow id is a slugified form of the name
        id: 'my-workflow',
        name: 'My Workflow',
        steps: [step],
        start: 'step',
        // should be ignored because this lives in the project file
        openfn: {
          id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
        },
      },
    ],
  });

  const { path, content } = extractWorkflow(project, 'my-workflow');
  t.is(path, 'workflows/my-workflow/my-workflow.yaml');

  t.deepEqual(
    content,
    `id: my-workflow
name: My Workflow
start: step
steps:
  - id: step
    adaptor: '@openfn/language-common@latest'
    expression: ./step.js
`
  );
});

test('extractWorkflow: single simple workflow with an edge', (t) => {
  const project = new Project(
    {
      workflows: [
        {
          id: 'my-workflow',
          name: 'My Workflow',
          steps: [
            {
              ...step,
              id: 'step1',
              next: {
                step2: {
                  // @ts-ignore
                  condition: true,
                  openfn: {
                    // should be excluded!
                    uuid: 1,
                  },
                },
              },
            },
            {
              ...step,
              id: 'step2',
            },
          ],
          openfn: {
            id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
          },
        },
      ],
    },
    {
      formats: {
        workflow: 'json', // for easier testing
      },
    }
  );

  const { path, content } = extractWorkflow(project, 'my-workflow');

  t.is(path, 'workflows/my-workflow/my-workflow.json');
  t.deepEqual(JSON.parse(content), {
    id: 'my-workflow',
    name: 'My Workflow',
    steps: [
      {
        id: 'step1',
        expression: './step1.js',
        adaptor: '@openfn/language-common@latest',
        next: {
          step2: {
            condition: true,
          },
        },
      },
      {
        id: 'step2',
        expression: './step2.js',
        adaptor: '@openfn/language-common@latest',
      },
    ],
  });
});

// Just to prove that basically any prop is written to steps - we're not fussy
test('extractWorkflow: single simple workflow with random edge property', (t) => {
  const project = new Project(
    {
      workflows: [
        {
          id: 'my-workflow',
          name: 'My Workflow',
          steps: [
            {
              ...step,
              // @ts-ignore
              foo: 'bar',
            },
          ],
          openfn: {
            id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
          },
        },
      ],
    },
    {
      formats: {
        workflow: 'json', // for easier testing
      },
    }
  );

  const { path, content } = extractWorkflow(project, 'my-workflow');

  t.is(path, 'workflows/my-workflow/my-workflow.json');
  t.deepEqual(JSON.parse(content), {
    id: 'my-workflow',
    name: 'My Workflow',
    steps: [
      {
        id: 'step',
        expression: './step.js',
        adaptor: '@openfn/language-common@latest',
        foo: 'bar',
      },
    ],
  });
});

test('extractWorkflow: excludes trigger enabled state (true)', (t) => {
  const project = new Project(
    {
      workflows: [
        {
          id: 'my-workflow',
          name: 'My Workflow',
          steps: [
            {
              id: 'webhook',
              type: 'webhook',
              openfn: {
                enabled: true,
              },
            },
          ],
          openfn: {
            id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
          },
        },
      ],
    },
    {
      formats: {
        workflow: 'json', // for easier testing
      },
    }
  );

  const { content } = extractWorkflow(project, 'my-workflow');

  t.deepEqual(JSON.parse(content).steps[0], {
    id: 'webhook',
    type: 'webhook',
  });
});

test('extractWorkflow: excludes trigger enabled state (false)', (t) => {
  const project = new Project(
    {
      workflows: [
        {
          id: 'my-workflow',
          name: 'My Workflow',
          steps: [
            {
              id: 'webhook',
              type: 'webhook',
              openfn: {
                enabled: false,
              },
            },
          ],
          openfn: {
            id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
          },
        },
      ],
    },
    {
      formats: {
        workflow: 'json', // for easier testing
      },
    }
  );

  const { content } = extractWorkflow(project, 'my-workflow');

  t.deepEqual(JSON.parse(content).steps[0], {
    id: 'webhook',
    type: 'webhook',
  });
});

test('extractWorkflow: includeSchemaVersion stamps schema_version into workflow', (t) => {
  const project = new Project(
    {
      workflows: [
        {
          id: 'my-workflow',
          steps: [step],
        },
      ],
    },
    {
      formats: {
        workflow: 'json',
      },
    }
  );

  const { content } = extractWorkflow(project, 'my-workflow', {
    includeSchemaVersion: true,
  });

  t.is(JSON.parse(content).schema_version, '4.0');
});

test('extractWorkflow: single simple workflow with custom root', (t) => {
  const config = {
    dirs: {
      workflows: './openfn/wfs/',
    },
    formats: {
      workflow: 'json', // for easier testing
    },
  };
  const project = new Project(
    {
      workflows: [
        {
          id: 'my-workflow',
          steps: [step],
        },
      ],
    },
    // @ts-ignore
    config
  );

  const { path } = extractWorkflow(project, 'my-workflow');

  t.is(path, 'openfn/wfs/my-workflow/my-workflow.json');
});

test('toFs: extract a project with 1 workflow and 1 step', (t) => {
  const project = new Project(
    {
      name: 'My Project',
      workflows: [
        {
          id: 'my-workflow',
          steps: [step],
        },
      ],
    },
    {
      formats: {
        openfn: 'json', // for easier testing
        workflow: 'json',
      },
    }
  );

  const files = toFs(project);

  // Ensure that all the right files have been created
  t.deepEqual(Object.keys(files), [
    'openfn.json',
    '.openfn/checkout.yaml',
    'workflows/my-workflow/my-workflow.json',
    'workflows/my-workflow/step.js',
  ]);

  // rough test on the file contents
  // (this should be validated in more detail by each step)
  const config = JSON.parse(files['openfn.json']);
  t.deepEqual(config, {
    credentials: 'credentials.yaml',
    dirs: { projects: '.projects', workflows: 'workflows' },
    formats: { openfn: 'json', project: 'yaml', workflow: 'json' },
  });

  const checkout = yamlToJson(files['.openfn/checkout.yaml']);
  t.deepEqual(checkout, {
    alias: 'main',
    id: 'my-project',
    name: 'My Project',
  });

  const workflow = JSON.parse(files['workflows/my-workflow/my-workflow.json']);
  t.is(workflow.id, 'my-workflow');
  t.is(workflow.steps.length, 1);

  t.is(files['workflows/my-workflow/step.js'], 'fn(s => s)');
});

test('toFs: writes an aliased workflow into its alias folder', (t) => {
  const project = new Project({
    name: 'My Project',
    workflows: [{ id: 'my-long-workflow-name', steps: [step] }],
  });
  project.workflows[0].alias = 'wf';

  const files = toFs(project);

  t.truthy(files['workflows/wf/my-long-workflow-name.yaml']);
  t.is(files['workflows/wf/step.js'], 'fn(s => s)');
  t.falsy(files['workflows/my-long-workflow-name/my-long-workflow-name.yaml']);
});

test('toFs: extract a project with forked_from meta', (t) => {
  const project = new Project(
    {
      name: 'My Project',
      workflows: [
        {
          id: 'my-workflow',
          steps: [step],
        },
      ],
      cli: {
        forked_from: 'abcd',
      },
    },
    {
      formats: {
        openfn: 'json', // for easier testing
        workflow: 'json',
      },
    }
  );

  const files = toFs(project);

  // Ensure that all the right files have been created
  t.deepEqual(Object.keys(files), [
    'openfn.json',
    '.openfn/checkout.yaml',
    'workflows/my-workflow/my-workflow.json',
    'workflows/my-workflow/step.js',
  ]);

  // rough test on the file contents
  // (this should be validated in more detail by each step)
  const config = JSON.parse(files['openfn.json']);
  t.deepEqual(config, {
    credentials: 'credentials.yaml',
    dirs: { projects: '.projects', workflows: 'workflows' },
    formats: { openfn: 'json', project: 'yaml', workflow: 'json' },
  });

  const checkout = yamlToJson(files['.openfn/checkout.yaml']);
  t.deepEqual(checkout, {
    alias: 'main',
    id: 'my-project',
    name: 'My Project',
    forked_from: 'abcd',
  });

  const workflow = JSON.parse(files['workflows/my-workflow/my-workflow.json']);
  t.is(workflow.id, 'my-workflow');
  t.is(workflow.steps.length, 1);

  t.is(files['workflows/my-workflow/step.js'], 'fn(s => s)');
});

test('toFs: writes collections to resources.yaml keyed by name (freshly authored, no uuid yet)', (t) => {
  const project = new Project(
    {
      name: 'My Project',
      collections: [{ name: 'my-collection' }, { name: 'another-collection' }],
      workflows: [],
    },
    {
      formats: {
        openfn: 'json',
        workflow: 'json',
      },
    }
  );

  const files = toFs(project);

  t.deepEqual(yamlToJson(files['resources.yaml']), {
    collections: { 'my-collection': {}, 'another-collection': {} },
  });
  // collections don't belong in openfn.json
  t.falsy(JSON.parse(files['openfn.json']).collections);
});

test('toFs: strips uuids from fetched collections when writing to resources.yaml', (t) => {
  const project = new Project({
    name: 'My Project',
    // this is the shape a freshly-fetched project's collections are in -
    // uuids should never be written to disk
    collections: [
      { uuid: 'remote-uuid-1', name: 'my-collection' },
      { uuid: 'remote-uuid-2', name: 'another-collection' },
    ],
    workflows: [],
  });

  const files = toFs(project);

  t.deepEqual(yamlToJson(files['resources.yaml']), {
    collections: { 'my-collection': {}, 'another-collection': {} },
  });
});

test('toFs: writes an empty collections key when the project has none', (t) => {
  const project = new Project({
    name: 'My Project',
    collections: [],
    workflows: [],
  });

  const files = toFs(project);

  // an empty key means "no collections", which is not the same as no key
  t.deepEqual(yamlToJson(files['resources.yaml']), { collections: {} });
});

test('toFs: writes collections and channels to the same resources.yaml', (t) => {
  const project = new Project({
    name: 'My Project',
    collections: [{ name: 'my-collection' }],
    channels: [
      {
        name: 'My Channel',
        destination_url: 'https://example.com',
        enabled: true,
      },
    ],
    workflows: [],
  });

  const resources = yamlToJson(toFs(project)['resources.yaml']);
  t.deepEqual(Object.keys(resources).sort(), ['channels', 'collections']);
});

test('toFs: does not write resources.yaml when collections are unknown', (t) => {
  const project = new Project({ name: 'My Project', workflows: [] });

  t.false('resources.yaml' in toFs(project));
});

test('toFs: writes channels to resources.yaml keyed by id, with credential names', (t) => {
  const project = new Project({
    name: 'My Project',
    credentials: [
      { uuid: 'cred-uuid', name: 'my-cred', owner: 'me@openfn.org' },
    ],
    channels: [
      {
        id: 'chan-uuid',
        name: 'My Channel',
        destination_url: 'https://example.com',
        enabled: true,
        destination_credential_id: 'cred-uuid',
      },
    ],
    workflows: [],
  });

  const files = toFs(project);

  t.deepEqual(yamlToJson(files['resources.yaml']), {
    channels: {
      'my-channel': {
        name: 'My Channel',
        destination_url: 'https://example.com',
        enabled: true,
        credential: 'me@openfn.org|my-cred',
      },
    },
  });
});

test('toFs: does not write resources.yaml when channels are unknown', (t) => {
  const project = new Project({ name: 'My Project', workflows: [] });

  const files = toFs(project);

  t.false('resources.yaml' in files);
});

// TODO we need many more tests on this, with options
