import test from 'ava';
import mock from 'mock-fs';
import { parseProject } from '../../src/parse/from-fs';
import { jsonToYaml } from '../../src/util/yaml';
import { buildConfig } from '../../src/util/config';

test.afterEach(() => {
  files = {};
  mock.restore();
});

let files: Record<string, string> = {};

function mockFile(path: string, content: string | object) {
  if (path.endsWith('.yaml')) {
    content = jsonToYaml(content);
  } else if (path.endsWith('.json')) {
    content = JSON.stringify(content);
  }

  files[path] = content;
  mock(files);
}

test.serial('should include multiple workflows', async (t) => {
  mockFile('/ws/openfn.yaml', buildConfig());

  mockFile('/ws/workflows/workflow-1/workflow-1.yaml', {
    id: 'workflow-1',
    name: 'Workflow 1',
    steps: [
      {
        id: 'a',
        expression: 'job.js',
      },
    ],
  });

  mockFile('/ws/workflows/workflow-1/job.js', `fn(s => s)`);

  mockFile('/ws/workflows/workflow-2/workflow-2.yaml', {
    id: 'workflow-2',
    name: 'Workflow 2',
    steps: [
      {
        id: 'b',
        expression: 'job.js',
      },
    ],
  });

  mockFile('/ws/workflows/workflow-2/job.js', `fn(s => ({ data: [] }))`);

  const project = await parseProject({ root: '/ws' });

  t.is(project.workflows.length, 2);

  const wf1 = project.getWorkflow('workflow-1');
  t.truthy(wf1);
  t.is(wf1.id, 'workflow-1');
  t.is(wf1.name, 'Workflow 1');

  const wf2 = project.getWorkflow('workflow-2');
  t.truthy(wf2);
  t.is(wf2.id, 'workflow-2');
  t.is(wf2.name, 'Workflow 2');
});

test.serial('should load a workflow expression', async (t) => {
  mockFile('/ws/openfn.yaml', buildConfig());

  mockFile('/ws/workflows/my-workflow/my-workflow.yaml', {
    id: 'my-workflow',
    name: 'My Workflow',
    steps: [
      {
        id: 'a',
        expression: 'job.js',
      },
    ],
  });

  mockFile('/ws/workflows/my-workflow/job.js', `fn(s => s)`);

  const project = await parseProject({ root: '/ws' });
  t.is(project.workflows.length, 1);

  const wf = project.getWorkflow('my-workflow');

  t.truthy(wf);

  t.is(wf.steps[0].expression, 'fn(s => s)');
});

test.serial(
  'should return empty workflows array when no workflows found',
  async (t) => {
    mockFile('/ws/openfn.yaml', buildConfig());

    const project = await parseProject({ root: '/ws' });

    t.is(project.workflows.length, 0);
  }
);

test.serial(
  'should load a workflow from the file system and expand shorthand links',
  async (t) => {
    mockFile('/ws/openfn.yaml', buildConfig());

    mockFile('/ws/workflows/my-workflow/my-workflow.yaml', {
      id: 'my-workflow',
      name: 'My Workflow',
      steps: [
        {
          id: 'a',
          expression: 'job.js',
          next: {
            b: true,
          },
        },
        {
          id: 'b',
          expression: './job.js',
          next: {
            c: false,
          },
        },
      ],
    });

    mockFile('/ws/workflows/my-workflow/job.js', `fn(s => s)`);

    const project = await parseProject({ root: '/ws' });

    t.is(project.workflows.length, 1);
    const [wf] = project.workflows;

    t.is(typeof wf.steps[1].next.c, 'object');
  }
);
