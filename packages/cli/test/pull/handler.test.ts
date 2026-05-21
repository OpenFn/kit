import test from 'ava';
import mockfs from 'mock-fs';
import fs from 'node:fs';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { createMockLogger } from '@openfn/logger';

import pullHandler from '../../src/pull/handler';
import { PullOptions } from '../../src/pull/command';
import { myProject_v1 } from '../projects/fixtures';

const ENDPOINT = 'https://app.openfn.org';
const PROJECT_UUID = 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00';

test.beforeEach(() => {
  mockfs.restore();
});

test.afterEach(() => {
  mockfs.restore();
});

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

const options: PullOptions = {
  beta: false,
  command: 'pull',
  configPath: '/tmp/config.json',
  projectId: PROJECT_UUID,
  confirm: false,
  snapshots: [],
  workspace: '/tmp', // needed in tests to drive other paths
};

test.serial(
  'redirects to beta handler when openfn.yaml exists in cwd',
  async (t) => {
    const logger = createMockLogger('', { level: 'debug' });
    mockfs({
      ['/tmp/config.json']: `{"apiKey": "123", "endpoint": "${ENDPOINT}"}`,
      ['/tmp/openfn.yaml']: `
project:
  endpoint: ${ENDPOINT}`,
    });

    await pullHandler(options, logger);

    t.true(fs.existsSync('/tmp/.projects/main@app.openfn.org.yaml'));

    t.truthy(logger._find('always', /Detected openfn.yaml file/i));
  }
);

test.serial('does not create credentials.yaml when redirecting', async (t) => {
  const logger = createMockLogger('', { level: 'debug' });
  mockfs({
    ['/tmp/config.json']: `{"apiKey": "123", "endpoint": "${ENDPOINT}"}`,
    ['/tmp/openfn.yaml']: `
project:
  endpoint: ${ENDPOINT}`,
  });

  await pullHandler(options, logger);

  t.false(fs.existsSync('/tmp/credentials.yaml'));
});
