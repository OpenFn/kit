import { readFile } from 'node:fs/promises';
import test from 'ava';
import mock from 'mock-fs';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { createMockLogger } from '@openfn/logger';

import { handler as fetchHandler } from '../../src/projects/fetch';
import { myProject_v1, myProject_yaml } from './fixtures';

const logger = createMockLogger('', { level: 'debug' });

const ENDPOINT = 'https://app.openfn.org';
const PROJECT_ID = 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00';

let mockAgent = new MockAgent();
mockAgent.disableNetConnect();
setGlobalDispatcher(mockAgent);

test.beforeEach(() => {
  mock({
    '/ws/.projects': {},
    '/ws/openfn.yaml': `
project:
  id: test-project
  name: Test Project
workspace:
  formats:
    project: yaml
`,
  });
  logger._reset();
});

test.afterEach(() => {
  mock.restore();
});

test.serial(
  'fetch v1 app state and write to disk as project.yaml',
  async (t) => {
    const mockPool = mockAgent.get(ENDPOINT);
    mockPool
      .intercept({
        path: `/api/provision/${PROJECT_ID}?`,
        method: 'GET',
      })
      .reply(200, {
        data: myProject_v1,
      });

    await fetchHandler(
      {
        projectId: PROJECT_ID,
        endpoint: ENDPOINT,
        apiKey: 'test-api-key',

        workspace: '/ws',
        env: 'project',
        outputPath: '/ws',
      } as any,
      logger
    );

    const filePath = '/ws/.projects/project@app.openfn.org.yaml';
    const fileContent = await readFile(filePath, 'utf-8');

    const yaml = myProject_yaml;

    t.is(fileContent.trim(), yaml);

    const { message, level } = logger._parse(logger._last);
    t.is(level, 'success');
    t.regex(message, /Fetched project file to/);
  }
);
