import test from 'ava';
import mockfs from 'mock-fs';
import { createMockLogger } from '@openfn/logger';
import pullHandler from '../../src/pull/handler';
import { PullOptions } from '../../src/pull/command';

test.beforeEach(() => {
  mockfs.restore();
});

test.afterEach(() => {
  mockfs.restore();
});

const options: PullOptions = {
  beta: false,
  command: 'pull',
  projectPath: './project.yaml',
  configPath: './config.json',
  projectId: 'abc-123',
  confirm: false,
  snapshots: [],
};

test.serial(
  'redirects to beta handler when openfn.yaml exists in cwd',
  async (t) => {
    const logger = createMockLogger('', { level: 'debug' });
    mockfs({
      ['./config.json']: `{"apiKey": "123"}`,
      ['./openfn.yaml']: '',
    });

    await t.throwsAsync(() => pullHandler(options, logger));

    t.truthy(logger._find('info', /Switching to openfn project pull/));
  }
);
