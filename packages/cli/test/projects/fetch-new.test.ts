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

// fetch to new local file
// fetch and overwrite local file

// throw if identifier resolution is ambiguous
