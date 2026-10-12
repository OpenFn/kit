import test from 'ava';
import mockfs from 'mock-fs';
import fs from 'node:fs';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { createMockLogger } from '@openfn/logger';

import pullHandler from '../../src/pull/handler';
import { PullOptions } from '../../src/pull/command';
import { Workspace } from '@openfn/project';
import { myProject_v1 } from '../projects/fixtures';

const ENDPOINT = 'https://fake.test.openfn.org';
const PROJECT_UUID = 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00';

test.beforeEach(() => {
  mockfs.restore();

  process.env.OPENFN_API_KEY = 'fake-api-key';
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

const options: Partial<PullOptions> = {
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

    t.true(fs.existsSync('/tmp/.projects/main@fake.test.openfn.org.yaml'));

    t.truthy(logger._find('always', /Detected openfn.yaml file/i));
  }
);

test.serial(
  'openfn yaml endpoint preferred to config.json endpoint',
  async (t) => {
    const logger = createMockLogger('', { level: 'debug' });
    mockfs({
      ['/tmp/config.json']: `{"apiKey": "123", "endpoint": "DOES_NOT_EXIST"}`,
      ['/tmp/openfn.yaml']: `
project:
  endpoint: ${ENDPOINT}`,
    });

    // This would throw if the config.json endpoint is used
    await pullHandler(options, logger);

    t.pass();
  }
);

test.serial(
  'CLI endpoint preferred to openfn.yaml and config.json endpoints',
  async (t) => {
    const logger = createMockLogger('', { level: 'debug' });
    mockfs({
      ['/tmp/config.json']: `{"apiKey": "123", "endpoint": "DOES_NOT_EXIST"}`,
      ['/tmp/openfn.yaml']: `
project:
  endpoint: INVALID_URL`,
    });

    // This would throw if any config endpoint is used
    await pullHandler(
      {
        ...options,
        endpoint: ENDPOINT,
      } as any,
      logger
    );

    t.pass();
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

test.serial(
  'tracks the pulled project in the workspace when redirecting with legacy config.yaml structure',
  async (t) => {
    const logger = createMockLogger('', { level: 'debug' });
    mockfs({
      ['/tmp/openfn.yaml']: `
project:
  endpoint: ${ENDPOINT}`,
    });

    await pullHandler(options, logger);

    const ws = new Workspace('/tmp');
    t.is(ws.activeProject?.uuid, PROJECT_UUID);

    const tracked = ws.getTrackedProject();
    t.truthy(tracked);
    t.is(tracked?.openfn?.endpoint, ENDPOINT);
    t.is(tracked?.openfn?.uuid, PROJECT_UUID);
  }
);

test.serial(
  'tracks the pulled project in the workspace when redirecting with new checkout.yaml file',
  async (t) => {
    const logger = createMockLogger('', { level: 'debug' });
    mockfs({
      ['/tmp/.openfn/checkout.yaml']: `
  endpoint: ${ENDPOINT}`,
      ['/tmp/openfn.yaml']: '',
    });

    await pullHandler(options, logger);

    const ws = new Workspace('/tmp');
    t.is(ws.activeProject?.uuid, PROJECT_UUID);

    const tracked = ws.getTrackedProject();
    t.truthy(tracked);
    t.is(tracked?.openfn?.endpoint, ENDPOINT);
    t.is(tracked?.openfn?.uuid, PROJECT_UUID);
  }
);
