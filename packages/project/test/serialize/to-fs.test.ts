import test from 'ava';
import type { Provisioner } from '@openfn/lexicon/lightning';
import { Project } from '../../src/Project';
import toFs, {
  extractWorkflow,
  extractStep,
  mapWorkflow,
} from '../../src/serialize/to-fs';
import { extractConfig } from '../../src/util/config';

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

  // TODO is the empty options object correct here??
  t.deepEqual(
    content,
    `id: my-workflow
name: My Workflow
options: {}
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
    options: {},
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
    options: {},
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
    'workflows/my-workflow/my-workflow.json',
    'workflows/my-workflow/step.js',
  ]);

  // rough test on the file contents
  // (this should be validated in more detail by each step)
  const config = JSON.parse(files['openfn.json']);
  t.deepEqual(config, {
    workspace: {
      formats: { openfn: 'json', project: 'yaml', workflow: 'json' },
      dirs: { projects: '.projects', workflows: 'workflows' },
    },
    project: {
      id: 'my-project',
    },
  });

  const workflow = JSON.parse(files['workflows/my-workflow/my-workflow.json']);
  t.is(workflow.id, 'my-workflow');
  t.is(workflow.steps.length, 1);

  t.is(files['workflows/my-workflow/step.js'], 'fn(s => s)');
});

// TODO we need many more tests on this, with options
