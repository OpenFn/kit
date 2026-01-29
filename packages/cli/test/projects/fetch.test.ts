import { readFile, writeFile } from 'node:fs/promises';
import test from 'ava';
import mock from 'mock-fs';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { createMockLogger } from '@openfn/logger';

import { handler as fetchHandler } from '../../src/projects/fetch';
import { myProject_v1, myProject_yaml } from './fixtures';

const logger = createMockLogger('', { level: 'debug' });

const ENDPOINT = 'https://app.openfn.org';
const PROJECT_UUID = 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00';

// Track two different versions of a project yaml
// v1 might be stored locallym ready to be updated
const yaml_v1 = myProject_yaml.replace('fn()', 'alterState()');
// v2 is always returned by the mock lightning
const yaml_v2 = myProject_yaml;

const getYamlPath = (alias = 'main') =>
  `/ws/.projects/${alias}@app.openfn.org.yaml`;

let mockAgent = new MockAgent();
mockAgent.disableNetConnect();
setGlobalDispatcher(mockAgent);

test.before(() => {
  const mockPool = mockAgent.get(ENDPOINT);
  mockPool
    .intercept({
      path: `/api/provision/${PROJECT_UUID}?`,
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

test.serial('fetch by UUID to default new alias', async (t) => {
  t.throwsAsync(() => readFile(getYamlPath('main'), 'utf-8'));

  await fetchHandler(
    {
      project: PROJECT_UUID,

      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
    } as any,
    logger
  );

  const fileContent = await readFile(getYamlPath('main'), 'utf-8');
  t.log(fileContent);
  t.is(fileContent.trim(), yaml_v2);
});

test.serial('fetch by UUID to new custom alias', async (t) => {
  t.throwsAsync(() => readFile(getYamlPath('staging'), 'utf-8'));

  await fetchHandler(
    {
      project: PROJECT_UUID,
      alias: 'staging',

      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
    } as any,
    logger
  );

  const fileContent = await readFile(getYamlPath('staging'), 'utf-8');

  t.is(fileContent.trim(), yaml_v2);
});

test.serial('fetch by UUID to existing custom alias', async (t) => {
  // Set up a v1 project file
  await writeFile(getYamlPath('staging'), yaml_v1);
  const beforeContents = await readFile(getYamlPath('staging'), 'utf-8');
  t.regex(beforeContents, /alterState\(\)/);

  // Now fetch
  await fetchHandler(
    {
      project: PROJECT_UUID,
      alias: 'staging',

      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
    } as any,
    logger
  );

  // Now ensure the yaml is updated
  const fileContent = await readFile(getYamlPath('staging'), 'utf-8');
  t.is(fileContent.trim(), yaml_v2);
});

test.serial('error: fetch by UUID to incompatible custom alias ', async (t) => {
  // Set up a v1 project file with different UUID
  await writeFile(
    getYamlPath('staging'),
    yaml_v1.replace(PROJECT_UUID, 'abcdefg')
  );

  // The fetch should now throw
  await t.throwsAsync(
    () =>
      fetchHandler(
        {
          project: PROJECT_UUID,
          alias: 'staging',

          endpoint: ENDPOINT,
          apiKey: 'test-api-key',
          workspace: '/ws',
        } as any,
        logger
      ),
    {
      message: /A project with a different UUID exists at this location/i,
    }
  );
});

test.serial('force fetch by UUID to incompatible custom alias ', async (t) => {
  // Set up a v1 project file with different UUID
  await writeFile(
    getYamlPath('staging'),
    yaml_v1.replace(PROJECT_UUID, 'abcdefg')
  );

  await fetchHandler(
    {
      project: PROJECT_UUID,
      alias: 'staging',
      force: true,

      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
    } as any,
    logger
  );

  // Now ensure the yaml is updated
  const fileContent = await readFile(getYamlPath('staging'), 'utf-8');
  t.is(fileContent.trim(), yaml_v2);
});

test.serial('fetch by existing alias', async (t) => {
  // first set up the file system with a preloaded project file
  const filePath = '/ws/.projects/staging@app.openfn.org.yaml';
  await writeFile(filePath, myProject_yaml.replace('fn()', 'alterState()'));

  // Now fetch with an alias value
  await fetchHandler(
    {
      project: 'staging', // alias

      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
    } as any,
    logger
  );

  const fileContent = await readFile(filePath, 'utf-8');

  // Content should be restored to the default
  t.is(fileContent.trim(), myProject_yaml);
});

test.serial('fetch by alias and save to a different alias', async (t) => {
  await writeFile(getYamlPath('staging'), yaml_v1);
  const beforeContents = await readFile(getYamlPath('staging'), 'utf-8');
  t.regex(beforeContents, /alterState\(\)/);

  await fetchHandler(
    {
      project: PROJECT_UUID,
      alias: 'testing',

      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
    } as any,
    logger
  );

  // Now ensure the yaml is updated
  const fileContent = await readFile(getYamlPath('testing'), 'utf-8');
  t.is(fileContent.trim(), yaml_v2);

  // Now ensure that the staging alias is unchanged
  const stagingContents = await readFile(getYamlPath('staging'), 'utf-8');
  t.is(stagingContents.trim(), beforeContents);
});

test.serial('fetch by local id', async (t) => {
  // create a local staging project
  await writeFile(getYamlPath('staging'), yaml_v1);
  const beforeContents = await readFile(getYamlPath('staging'), 'utf-8');
  t.regex(beforeContents, /alterState\(\)/);

  await fetchHandler(
    {
      // use the project id but specify no alias
      project: 'my-project',

      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
    } as any,
    logger
  );

  const fileContent = await readFile(getYamlPath('staging'), 'utf-8');
  t.is(fileContent.trim(), yaml_v2);
});

test.serial('fetch by local id and save to a new alias', async (t) => {
  // create a local staging project
  await writeFile(getYamlPath('staging'), yaml_v1);
  const beforeContents = await readFile(getYamlPath('staging'), 'utf-8');
  t.regex(beforeContents, /alterState\(\)/);

  await fetchHandler(
    {
      // use the project id but specify no alias
      project: 'my-project',
      alias: 'testing',

      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
    } as any,
    logger
  );

  const fileContent = await readFile(getYamlPath('testing'), 'utf-8');
  t.is(fileContent.trim(), yaml_v2);

  // Now ensure that the staging alias is unchanged
  const stagingContents = await readFile(getYamlPath('staging'), 'utf-8');
  t.is(stagingContents.trim(), beforeContents);
});

test.serial('save to a local file with --out', async (t) => {
  await fetchHandler(
    {
      project: PROJECT_UUID,
      outputPath: '/ws/out.yaml',

      workspace: '/ws',
      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
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

test.serial('warn if --out and --alias are both set', async (t) => {
  await fetchHandler(
    {
      project: PROJECT_UUID,
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

test.todo('throw if identifier resolution is ambiguous');

test.serial('fetch using endpoint in project file', async (t) => {
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

test.serial('fetch by alias and domain', async (t) => {
  // set up a mock at localhost
  const mockPool = mockAgent.get('http://localhost');
  mockPool
    .intercept({
      path: `/api/provision/${PROJECT_UUID}?`,
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

  // Now fetch with an alias value and no endoint
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

test.serial(
  'save JSON to a custom location, overriding project defaults',
  async (t) => {
    await fetchHandler(
      {
        project: PROJECT_UUID,
        outputPath: '/ws/out.json',

        endpoint: ENDPOINT,
        apiKey: 'test-api-key',
        workspace: '/ws',
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
              id: 'webhook',
              type: 'webhook',
              openfn: {
                enabled: true,
                uuid: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
              },
              next: {
                'transform-data': {
                  disabled: false,
                  condition: 'always',
                  openfn: {
                    uuid: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
                  },
                },
              },
            },
          ],
          start: 'webhook',
          openfn: {
            uuid: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
            inserted_at: '2025-04-23T11:19:32Z',
            updated_at: '2025-04-23T11:19:32Z',
            lock_version: 1,
          },
          id: 'my-workflow',
          history: ['cli:ba19e179317f'],
        },
      ],
    };

    t.deepEqual(JSON.parse(fileContent), json);

    const { message, level } = logger._parse(logger._last);
    t.is(level, 'success');
    t.regex(message, /Fetched project file to/);
  }
);
// In this test, the file on disk has diverged from the remove
// This means changes could be lost, so we throw!
test.serial(
  'error: throw if fetching a project that has diverged',
  async (t) => {
    // Change project.yaml
    const modified = myProject_yaml
      .replace('fn()', 'fn(x)') // arbitrary edit so that we can track the change
      .replace(' - a', ' - z'); // change the local history to be incompatible

    // Make it look like we've checked out the project
    mock({
      '/ws/.projects': {},
      '/ws/openfn.yaml': '',
      '/ws/.projects/project@app.openfn.org.yaml': modified,
    });

    await t.throwsAsync(
      () =>
        fetchHandler(
          {
            project: PROJECT_UUID,
            alias: 'project',

            endpoint: ENDPOINT,
            apiKey: 'test-api-key',
            workspace: '/ws',
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
  }
);

test.serial('force merge a diverged project', async (t) => {
  // Change project.yaml
  const modified = myProject_yaml.replace('fn()', 'fn(x)');

  mock({
    '/ws/.projects': {},
    '/ws/openfn.yaml': '',
    '/ws/.projects/project@app.openfn.org.yaml': modified,
  });

  await fetchHandler(
    {
      project: PROJECT_UUID,
      alias: 'project',
      force: true,

      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      workspace: '/ws',
    } as any,
    logger
  );

  const filePath = '/ws/.projects/project@app.openfn.org.yaml';
  const fileContent = await readFile(filePath, 'utf-8');

  // The file should be overwritten
  t.regex(fileContent, /fn\(\)/);
});
