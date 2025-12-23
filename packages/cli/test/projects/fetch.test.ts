import { readFile, writeFile } from 'node:fs/promises';
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

test.serial(
  'fetch from lightning with UUID and save as v2 yaml file with default alias',
  async (t) => {
    await fetchHandler(
      {
        project: PROJECT_ID,
        endpoint: ENDPOINT,
        apiKey: 'test-api-key',

        workspace: '/ws',
      } as any,
      logger
    );

    const filePath = '/ws/.projects/main@app.openfn.org.yaml';
    const fileContent = await readFile(filePath, 'utf-8');

    const yaml = myProject_yaml;

    t.is(fileContent.trim(), yaml);

    const { message, level } = logger._parse(logger._last);
    t.is(level, 'success');
    t.regex(message, /Fetched project file to/);
  }
);

test.serial(
  'fetch from lightning with UUID and save as v2 yaml file with user alias',
  async (t) => {
    await fetchHandler(
      {
        project: PROJECT_ID,
        endpoint: ENDPOINT,
        apiKey: 'test-api-key',
        workspace: '/ws',
        alias: 'staging',
      } as any,
      logger
    );

    const filePath = '/ws/.projects/staging@app.openfn.org.yaml';
    const fileContent = await readFile(filePath, 'utf-8');

    const yaml = myProject_yaml;

    t.is(fileContent.trim(), yaml);

    const { message, level } = logger._parse(logger._last);
    t.is(level, 'success');
    t.regex(message, /Fetched project file to/);
  }
);

// TODO: error if alias not local
// TODO: fetch with local id
// TODO: fetch with active project
// TODO fetch with alias@domain
test.serial('fetch from lightning with alias', async (t) => {
  // first set up the file system with a preloaded project file
  const filePath = '/ws/.projects/staging@app.openfn.org.yaml';
  await writeFile(filePath, myProject_yaml.replace('fn()', 'alterState()'));

  // Now fetch with an alias value
  await fetchHandler(
    {
      project: 'staging',
      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
    } as any,
    logger
  );

  const fileContent = await readFile(filePath, 'utf-8');

  t.is(fileContent.trim(), myProject_yaml);
});

test.serial('use local endpoint when available', async (t) => {
  // first set up the file system with a preloaded project file
  const filePath = '/ws/.projects/staging@app.openfn.org.yaml';
  await writeFile(filePath, myProject_yaml);

  await fetchHandler(
    {
      project: 'staging',
      apiKey: 'test-api-key',
      workspace: '/ws',
      // No endpoint provided!
    } as any,
    logger
  );

  const fileContent = await readFile(filePath, 'utf-8');

  t.is(fileContent.trim(), myProject_yaml);
});

test.serial('ignore endpoint argument when fetching from local', async (t) => {
  // first set up the file system with a preloaded project file
  const filePath = '/ws/.projects/staging@app.openfn.org.yaml';
  await writeFile(filePath, myProject_yaml);

  // Now fetch with an alias value
  await fetchHandler(
    {
      project: 'staging',
      endpoint: 'localhost', // this must be ignored or the test will fail!
      apiKey: 'test-api-key',
      workspace: '/ws',
    } as any,
    logger
  );

  const fileContent = await readFile(filePath, 'utf-8');

  t.is(fileContent.trim(), myProject_yaml);
});

test.serial('fetch from lightning with alias and domain', async (t) => {
  // set up a mock at localhost
  const mockPool = mockAgent.get('http://localhost');
  mockPool
    .intercept({
      path: `/api/provision/${PROJECT_ID}?`,
      method: 'GET',
    })
    .reply(200, {
      data: myProject_v1,
    });

  // first set up the file system with preloaded project files
  await writeFile(
    '/ws/.projects/staging@app.openfn.org.yaml',
    myProject_yaml.replace('fn()', 'jam()')
  );

  await writeFile(
    '/ws/.projects/staging@localhost.yaml',
    myProject_yaml
      .replace('fn()', 'alterState()')
      .replace('https://app.openfn.org', 'http://localhost')
  );

  // Now fetch with an alias value
  await fetchHandler(
    {
      project: 'staging@localhost',
      apiKey: 'test-api-key',
      workspace: '/ws',
    } as any,
    logger
  );

  const fileContent = await readFile(
    '/ws/.projects/staging@localhost.yaml',
    'utf-8'
  );

  t.is(
    fileContent.trim(),
    myProject_yaml.replace('https://app.openfn.org', 'http://localhost')
  );
});

test.serial('save to a custom location', async (t) => {
  await fetchHandler(
    {
      project: PROJECT_ID,
      endpoint: ENDPOINT,
      apiKey: 'test-api-key',

      workspace: '/ws',
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

test.serial('warn if out and alias are both set', async (t) => {
  await fetchHandler(
    {
      project: PROJECT_ID,
      endpoint: ENDPOINT,
      apiKey: 'test-api-key',

      workspace: '/ws',
      outputPath: '/ws/out.yaml',
      alias: 'jam',
    } as any,
    logger
  );

  const warn = logger._find('warn', /alias "jam" was set/i);
  t.truthy(warn);

  // Should still output to the right place
  const filePath = '/ws/out.yaml';
  const fileContent = await readFile(filePath, 'utf-8');

  t.is(fileContent.trim(), myProject_yaml);
});

test.serial(
  'save JSON to a custom location, overriding project defaults',
  async (t) => {
    await fetchHandler(
      {
        project: PROJECT_ID,
        endpoint: ENDPOINT,
        apiKey: 'test-api-key',

        workspace: '/ws',
        alias: 'project',
        outputPath: '/ws/out.json',
      } as any,
      logger
    );

    const filePath = '/ws/out.json';
    const fileContent = await readFile(filePath, 'utf-8');

    const json = {
      id: 'my-project',
      name: 'My Project',
      cli: {
        version: 2,
      },
      description: 'my lovely project',
      collections: [],
      credentials: [],
      openfn: {
        uuid: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
        endpoint: 'https://app.openfn.org',
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
          history: ['cli:02582f3bb088'],
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
      project: PROJECT_ID,
      endpoint: ENDPOINT,
      apiKey: 'test-api-key',

      workspace: '/ws',
      alias: 'project',
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
          project: PROJECT_ID,
          endpoint: ENDPOINT,
          apiKey: 'test-api-key',

          workspace: '/ws',
          alias: 'project',
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
      project: PROJECT_ID,
      endpoint: ENDPOINT,
      apiKey: 'test-api-key',

      workspace: '/ws',
      alias: 'project',
      force: true,
    } as any,
    logger
  );

  const filePath = '/ws/.projects/project@app.openfn.org.yaml';
  const fileContent = await readFile(filePath, 'utf-8');

  // The file should be overwritten
  t.regex(fileContent, /fn\(\)/);
});
