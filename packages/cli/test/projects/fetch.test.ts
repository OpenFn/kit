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

test.before(() => {
  const mockPool = mockAgent.get(ENDPOINT);
  mockPool
    .intercept({
      path: `/api/provision/${PROJECT_ID}?`,
      method: 'GET',
    })
    .reply(200, {
      data: myProject_v1,
    })
    .persist();
});

test.beforeEach(() => {
  mock({
    '/ws/.projects': {},
    '/ws/openfn.yaml': '',
  });
  logger._reset();
});

test.afterEach(() => {
  mock.restore();
});

test.serial('fetch from lightning and save as v2 yaml file', async (t) => {
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
});

test.serial('save to a custom location', async (t) => {
  await fetchHandler(
    {
      projectId: PROJECT_ID,
      endpoint: ENDPOINT,
      apiKey: 'test-api-key',

      workspace: '/ws',
      env: 'project',
      outputPath: '/ws/out.yaml',
    } as any,
    logger
  );

  const filePath = '/ws/out.yaml';
  const fileContent = await readFile(filePath, 'utf-8');

  const yaml = myProject_yaml;

  t.is(fileContent.trim(), yaml);

  const { message, level } = logger._parse(logger._last);
  t.is(level, 'success');
  t.regex(message, /Fetched project file to/);
});

test.serial(
  'save JSON to a custom location, overriding project defaults',
  async (t) => {
    await fetchHandler(
      {
        projectId: PROJECT_ID,
        endpoint: ENDPOINT,
        apiKey: 'test-api-key',

        workspace: '/ws',
        env: 'project',
        outputPath: '/ws/out.json',
      } as any,
      logger
    );

    const filePath = '/ws/out.json';
    const fileContent = await readFile(filePath, 'utf-8');

    const json = {
      id: 'my-project',
      name: 'My Project',
      version: 2,
      description: 'my lovely project',
      collections: [],
      credentials: [],
      openfn: {
        uuid: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
        endpoint: 'https://app.openfn.org',
        env: 'project',
        inserted_at: '2025-04-23T11:15:59Z',
        updated_at: '2025-04-23T11:15:59Z',
      },
      options: {
        allow_support_access: false,
        requires_mfa: false,
        retention_policy: 'retain_all',
      },
      workflows: [
        {
          name: 'My Workflow',
          steps: [
            {
              id: 'transform-data',
              name: 'Transform data',
              expression: 'fn()',
              adaptor: '@openfn/language-common@latest',
              openfn: {
                uuid: '66add020-e6eb-4eec-836b-20008afca816',
              },
            },
            {
              id: 'trigger',
              type: 'webhook',
              openfn: {
                enabled: true,
                uuid: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
              },
              next: {
                'transform-data': {
                  disabled: false,
                  condition: true,
                  openfn: {
                    uuid: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
                  },
                },
              },
            },
          ],
          openfn: {
            uuid: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
            inserted_at: '2025-04-23T11:19:32Z',
            updated_at: '2025-04-23T11:19:32Z',
            lock_version: 1,
          },
          id: 'my-workflow',
          history: ['a'],
        },
      ],
    };

    t.deepEqual(JSON.parse(fileContent), json);

    const { message, level } = logger._parse(logger._last);
    t.is(level, 'success');
    t.regex(message, /Fetched project file to/);
  }
);

test.serial('Override a compatible project', async (t) => {
  // Change project.yaml
  const modified = myProject_yaml.replace('my lovely project', 'renamed');

  mock({
    '/ws/.projects': {},
    '/ws/openfn.yaml': '',
    '/ws/.projects/project@app.openfn.org.yaml': modified,
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

  // This should overwrite the renamed value back to the default
  t.regex(fileContent, /my lovely project/);
});

// In this test, the file on disk has diverged from the remove
// This means changes could be lost, so we throw!
test.serial('throw for an incompatible project', async (t) => {
  // Change project.yaml
  const modified = myProject_yaml
    .replace('fn()', 'fn(x)') // arbitrary edit so that we can track the change
    .replace(' - a', ' - z'); // change the local history to be incompatible

  mock({
    '/ws/.projects': {},
    '/ws/openfn.yaml': '',
    '/ws/.projects/project@app.openfn.org.yaml': modified,
  });

  await t.throwsAsync(
    () =>
      fetchHandler(
        {
          projectId: PROJECT_ID,
          endpoint: ENDPOINT,
          apiKey: 'test-api-key',

          workspace: '/ws',
          env: 'project',
          outputPath: '/ws',
        } as any,
        logger
      ),
    {
      message: /incompatible project/,
    }
  );

  const filePath = '/ws/.projects/project@app.openfn.org.yaml';
  const fileContent = await readFile(filePath, 'utf-8');

  // The file should NOT be overwritten
  t.regex(fileContent, /fn\(x\)/);
});

test.serial('force merge an incompatible project', async (t) => {
  // Change project.yaml
  const modified = myProject_yaml.replace('fn()', 'fn(x)');

  mock({
    '/ws/.projects': {},
    '/ws/openfn.yaml': '',
    '/ws/.projects/project@app.openfn.org.yaml': modified,
  });

  await fetchHandler(
    {
      projectId: PROJECT_ID,
      endpoint: ENDPOINT,
      apiKey: 'test-api-key',

      workspace: '/ws',
      env: 'project',
      outputPath: '/ws',
      force: true,
    } as any,
    logger
  );

  const filePath = '/ws/.projects/project@app.openfn.org.yaml';
  const fileContent = await readFile(filePath, 'utf-8');

  // The file should be overwritten
  t.regex(fileContent, /fn\(\)/);
});
