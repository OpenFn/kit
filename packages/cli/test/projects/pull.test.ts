import test from 'ava';
import mock from 'mock-fs';
import { createMockLogger } from '@openfn/logger';

import { ensureProjectId } from '../../src/projects/pull';
import { UUID, myProject_yaml } from './fixtures';

const logger = createMockLogger('', { level: 'debug' });

const WORKSPACE = '/ws';

const openfnYaml = `project:
  uuid: ${UUID}
  id: my-project
  endpoint: https://app.openfn.org
`;

test.beforeEach(() => {
  logger._reset();
});

test.afterEach(() => {
  mock.restore();
});

test('no project: defaults to active project UUID from workspace', (t) => {
  mock({
    '/ws/openfn.yaml': openfnYaml,
    '/ws/.projects': {},
  });

  const options: any = { workspace: WORKSPACE };
  ensureProjectId(options, logger);

  t.is(options.project, UUID);
});

test('no project: throws if no active project in workspace', (t) => {
  mock({
    '/ws/openfn.yaml': '',
    '/ws/.projects': {},
  });

  const options: any = { workspace: WORKSPACE };
  t.throws(() => ensureProjectId(options, logger), {
    message: /Project not provided/,
  });
});

test('valid alias: passes through when found in workspace', (t) => {
  mock({
    '/ws/openfn.yaml': openfnYaml,
    '/ws/.projects/my-project@app.openfn.org.yaml': myProject_yaml,
  });

  const options: any = { workspace: WORKSPACE, project: 'my-project' };
  ensureProjectId(options, logger);

  t.is(options.project, 'my-project');
});

test('invalid alias: throws a clear error when not found in workspace', (t) => {
  mock({
    '/ws/openfn.yaml': openfnYaml,
    '/ws/.projects': {},
  });

  const options: any = { workspace: WORKSPACE, project: 'nonexistent' };
  t.throws(() => ensureProjectId(options, logger), {
    message: /Project "nonexistent" not found/,
  });
});
