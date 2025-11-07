import test from 'ava';
import {
  extractConfig,
  findWorkspaceFile,
  loadWorkspaceFile,
} from '../../src/util/config';
import mock from 'mock-fs';
import Project from '../../src';

test.afterEach(() => {
  mock.restore();
});

test('load config as yaml', (t) => {
  const yaml = `
workspace:
  dirs:
    projects: p
    workflows: w
  formats:
    openfn: yaml
    project: json
    workflow: yaml
  x: 1
project:
  name: joe-sandbox-testing
  uuid: d3367267-ef25-41cf-91b2-43d18f831f3c
  endpoint: https://app.staging.openfn.org
  env: dev
  inserted_at: 2025-10-21T17:10:57Z
  updated_at: 2025-10-21T17:10:57Z
`;
  const result = loadWorkspaceFile(yaml);

  t.deepEqual(result.workspace, {
    dirs: {
      projects: 'p',
      workflows: 'w',
    },
    formats: {
      openfn: 'yaml',
      project: 'json',
      workflow: 'yaml',
    },
    x: 1,
  });
  t.deepEqual(result.project, {
    name: 'joe-sandbox-testing',
    uuid: 'd3367267-ef25-41cf-91b2-43d18f831f3c',
    endpoint: 'https://app.staging.openfn.org',
    env: 'dev',
    inserted_at: '2025-10-21T17:10:57Z',
    updated_at: '2025-10-21T17:10:57Z',
  });
});

test.todo('load config as json');

// Note that the legacy format is the old 0.6 version of openfn.yaml
test('legacy: load config as yaml', (t) => {
  const yaml = `
name: joe-sandbox-testing
workflowRoot: workflows
formats:
  openfn: yaml
  project: json
  workflow: yaml
project:
  uuid: d3367267-ef25-41cf-91b2-43d18f831f3c
  endpoint: https://app.staging.openfn.org
  env: dev
  inserted_at: 2025-10-21T17:10:57Z
  updated_at: 2025-10-21T17:10:57Z
`;
  const result = loadWorkspaceFile(yaml);

  t.deepEqual(result.workspace, {
    workflowRoot: 'workflows',
    formats: {
      openfn: 'yaml',
      project: 'json',
      workflow: 'yaml',
    },
  });
  t.deepEqual(result.project, {
    name: 'joe-sandbox-testing',
    uuid: 'd3367267-ef25-41cf-91b2-43d18f831f3c',
    endpoint: 'https://app.staging.openfn.org',
    env: 'dev',
    inserted_at: '2025-10-21T17:10:57Z',
    updated_at: '2025-10-21T17:10:57Z',
  });
});

test('legacy: load config as json', (t) => {
  const json = JSON.stringify({
    name: 'joe-sandbox-testing',
    workflowRoot: 'workflows',
    formats: {
      openfn: 'yaml',
      project: 'json',
      workflow: 'yaml',
    },
    project: {
      uuid: 'd3367267-ef25-41cf-91b2-43d18f831f3c',
      endpoint: 'https://app.staging.openfn.org',
      env: 'dev',
      inserted_at: '2025-10-21T17:10:57Z',
      updated_at: '2025-10-21T17:10:57Z',
    },
  });
  const result = loadWorkspaceFile(json, 'json');

  t.deepEqual(result.workspace, {
    workflowRoot: 'workflows',
    formats: {
      openfn: 'yaml',
      project: 'json',
      workflow: 'yaml',
    },
  });
  t.deepEqual(result.project, {
    name: 'joe-sandbox-testing',
    uuid: 'd3367267-ef25-41cf-91b2-43d18f831f3c',
    endpoint: 'https://app.staging.openfn.org',
    env: 'dev',
    inserted_at: '2025-10-21T17:10:57Z',
    updated_at: '2025-10-21T17:10:57Z',
  });
});

test('legacy: load empty config', (t) => {
  const yaml = ``;
  const result = loadWorkspaceFile(yaml);

  t.deepEqual(result.workspace, {});
  t.deepEqual(result.project, {});
});

test('find openfn.yaml', (t) => {
  mock({ '/tmp/openfn.yaml': 'x: 1' });

  const result = findWorkspaceFile('/tmp');
  t.is(result.type, 'yaml');
  t.is(result.content, 'x: 1');
});

test('find openfn.json', (t) => {
  mock({ '/tmp/openfn.json': '{ "x": 1 }' });

  const result = findWorkspaceFile('/tmp');
  t.is(result.type, 'json');
  t.deepEqual(result.content, { x: 1 });
});

test('generate openfn.yaml', (t) => {
  const proj = new Project(
    {
      id: 'my-project',
      name: 'My Project',
      openfn: {
        uuid: 1234,
      },
    },
    {
      formats: {
        openfn: 'yaml',
      },
    }
  );
  const result = extractConfig(proj);
  t.is(result.path, 'openfn.yaml'),
    t.deepEqual(
      result.content,
      `project:
  uuid: 1234
  id: my-project
workspace:
  formats:
    openfn: yaml
    project: yaml
    workflow: yaml
  dirs:
    projects: .projects
    workflows: workflows
`
    );
});

test.todo('generate openfn.json');
