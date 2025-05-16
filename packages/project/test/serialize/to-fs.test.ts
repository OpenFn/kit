import test from 'ava';
import type { Provisioner } from '@openfn/lexicon/lightning';
import { Project } from '../../src/Project';
import toFs, {
  extractWorkflow,
  extractStep,
  extractRepoConfig,
  mapWorkflow,
} from '../../src/serialize/to-fs';

const stringify = (json) => JSON.stringify(json, null, 2);

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
steps:
  - id: step
    adaptor: "@openfn/language-common@latest"
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
                  condition: true,
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

test('extractWorkflow: single simple workflow with custom root', (t) => {
  const config = {
    workflowRoot: './openfn/wfs/',
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
    config
  );

  const { path, content } = extractWorkflow(project, 'my-workflow');

  t.is(path, 'openfn/wfs/my-workflow/my-workflow.json');
});

test('extractStep: extract a step', (t) => {
  const project = new Project({
    workflows: [
      {
        id: 'my-workflow',
        steps: [step],
      },
    ],
  });

  const { path, content } = extractStep(project, 'my-workflow', 'step');

  t.is(path, 'workflows/my-workflow/step.js');
  t.is(content, step.expression);
});

test('extractConfig: create a default openfn.json', (t) => {
  const project = new Project(
    {
      openfn: {
        env: 'main',
        id: '123',
        endpoint: 'app.openfn.org',
      },
      workflows: [
        {
          id: 'my-workflow',
          steps: [step],
        },
      ],
    },
    // TODO still a little uncomfortable about this structure
    {
      formats: {
        openfn: 'json', // note that we have to set this
      },
    }
  );
  const { path, content } = extractRepoConfig(project);

  t.is(path, 'openfn.json');
  t.deepEqual(JSON.parse(content), {
    workflowRoot: 'workflows',
    formats: {
      openfn: 'json',
      workflow: 'yaml',
      project: 'yaml',
    },
    project: {
      id: '123',
      endpoint: 'app.openfn.org',
      env: 'main',
    },
  });
});

test('extractConfig: create a default openfn.yaml', (t) => {
  const project = new Project({
    name: 'My Project',
    openfn: {
      env: 'main',
      id: '123',
      endpoint: 'app.openfn.org',
    },
    workflows: [
      {
        id: 'my-workflow',
        steps: [step],
      },
    ],
  });

  const { path, content } = extractRepoConfig(project);

  t.is(path, 'openfn.yaml');
  t.is(
    content,
    `name: My Project
workflowRoot: workflows
formats:
  openfn: yaml
  project: yaml
  workflow: yaml
project:
  env: main
  id: "123"
  endpoint: app.openfn.org
`
  );
});

test('extractConfig: include empty project config for local projects', (t) => {
  const project = new Project(
    {
      // no openfn obj!
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
      },
    }
  );

  const { path, content } = extractRepoConfig(project);
  t.log(path);
  t.log(content);

  t.is(path, 'openfn.json');
  t.deepEqual(JSON.parse(content), {
    workflowRoot: 'workflows',
    formats: {
      openfn: 'json',
      workflow: 'yaml',
      project: 'yaml',
    },
    project: {},
  });
});

test('toFs: extract a project with 1 workflow and 1 step', (t) => {
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
        openfn: 'json', // for easier testing
        workflow: 'json',
      },
    }
  );

  const files = toFs(project);

  // Ensure that all the right files have been created
  t.deepEqual(Object.keys(files), [
    'openfn.json',
    'workflows/my-workflow/my-workflow.json',
    'workflows/my-workflow/step.js',
  ]);

  // rough test on the file contents
  // (this should be validated in more detail by each step)
  const config = JSON.parse(files['openfn.json']);
  t.deepEqual(config, {
    workflowRoot: 'workflows',
    formats: { openfn: 'json', project: 'yaml', workflow: 'json' },
    project: {},
  });

  const workflow = JSON.parse(files['workflows/my-workflow/my-workflow.json']);
  t.is(workflow.id, 'my-workflow');
  t.is(workflow.steps.length, 1);

  t.is(files['workflows/my-workflow/step.js'], 'fn(s => s)');
});

// TODO we need many more tests on this, with options
