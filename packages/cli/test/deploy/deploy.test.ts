// Test the actual functionality of docgen
// ie, generate docs to a mock folder
import test from 'ava';
import mockfs from 'mock-fs';
import { Logger, createMockLogger } from '@openfn/logger';
import deployHandler, { DeployFn } from '../../src/deploy/handler';

import { DeployError, type DeployConfig } from '@openfn/deploy';
import { DeployOptions } from '../../src/deploy/command';

const logger = createMockLogger();

const originalEnv = process.env;

test.beforeEach(() => {
  mockfs.restore();
  logger._reset();
  mockfs({
    ['./config.json']: `{"apiKey": "123"}`,
    ['./project.yaml']: `{"apiKey": "123"}`,
  });

  process.env = originalEnv;
});

type Fn<Params extends unknown[] = any[], Result = any> = (
  ...args: Params
) => Result;

const mockDeploy: Fn<Parameters<DeployFn>, Promise<DeployConfig>> = (
  config: DeployConfig,
  _logger: Logger
) => {
  return Promise.resolve(config);
};

const options: DeployOptions = {
  configPath: './config.json',
  projectPath: './project.yaml',
  statePath: './state.json',
  command: 'deploy',
  log: ['info'],
  logJson: false,
  confirm: false,
};

test.serial('reads in config file', async (t) => {
  await deployHandler(options, logger, mockDeploy);
  t.pass();
});

test.serial('uses confirm option for requireConfirmation', async (t) => {
  let config = await deployHandler(options, logger, mockDeploy);

  t.is(config.requireConfirmation, false);
});

test.serial(
  'accepts env variables to override endpoint and api key',
  async (t) => {
    process.env['OPENFN_API_KEY'] = 'newkey';
    let config = await deployHandler(options, logger, mockDeploy);

    t.is(config.apiKey, 'newkey');
    t.is(config.endpoint, 'https://app.openfn.org/api/provision');

    process.env['OPENFN_ENDPOINT'] = 'http://other-endpoint.com';
    config = await deployHandler(options, logger, mockDeploy);

    t.is(config.apiKey, 'newkey');
    t.is(config.endpoint, 'http://other-endpoint.com');
  }
);

test.serial('sets the exit code to 0', async (t) => {
  const origExitCode = process.exitCode;
  await deployHandler(options, logger, () => Promise.resolve(true));

  t.is(process.exitCode, 0);
  process.exitCode = origExitCode;
});

test.serial('sets the exit code to 1', async (t) => {
  const origExitCode = process.exitCode;
  await deployHandler(options, logger, () => Promise.resolve(false));

  t.is(process.exitCode, 1);
  process.exitCode = origExitCode;
});

test.serial('catches DeployErrors', async (t) => {
  const origExitCode = process.exitCode;

  await deployHandler(options, logger, () =>
    Promise.reject(new DeployError('foo bar', 'STATE_ERROR'))
  );

  t.is(process.exitCode, 10);
  process.exitCode = origExitCode;
});
