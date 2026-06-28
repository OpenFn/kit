// Test the actual functionality of docgen
// ie, generate docs to a mock folder
import test from 'ava';
import mockfs from 'mock-fs';
import { Logger, createMockLogger } from '@openfn/logger';
import deployHandler, {
  DeployFn,
  maybeConvertV2spec,
} from '../../src/deploy/handler';
import { yamlToJson } from '@openfn/project';

import { DeployError, type DeployConfig } from '@openfn/deploy';
import { DeployOptions } from '../../src/deploy/command';

const logger = createMockLogger();

const { OPENFN_API_KEY, OPENFN_ENDPOINT, ...originalEnv } = process.env;

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

test.serial(
  'redirects to beta handler when openfn.yaml exists in cwd',
  async (t) => {
    t.plan(3);
    mockfs({
      ['./config.json']: `{"apiKey": "123"}`,
      ['./project.yaml']: `{"apiKey": "123"}`,
      ['./openfn.yaml']: 'project:\n  endpoint: https://from-yaml.org',
    });

    await deployHandler(options, logger, mockDeploy, async (args: any) => {
      t.is(args.force, true);
      t.is(args.endpoint, 'https://from-yaml.org');
      t.truthy(logger._find('always', /Detected openfn.yaml file/i));
    });
  }
);

test.serial('does not redirect when PREFER_LEGACY_SYNC is set', async (t) => {
  t.plan(1);
  mockfs({
    ['./config.json']: `{"apiKey": "123", "endpoint": "https://api.example.com"}`,
    ['./project.yaml']: `{"apiKey": "123"}`,
    ['./openfn.yaml']: 'project:\n  endpoint: https://from-yaml.org',
  });
  process.env.PREFER_LEGACY_SYNC = '1';

  await deployHandler(options, logger, mockDeploy, async (args: any) => {
    t.fail('called beta handler');
  });

  delete process.env.PREFER_LEGACY_SYNC;
  t.pass();
});

test.serial('CLI endpoint preferred over openfn.yaml endpoint', async (t) => {
  t.plan(1);
  mockfs({
    ['./config.json']: `{"apiKey": "123"}`,
    ['./project.yaml']: `{"apiKey": "123"}`,
    ['./openfn.yaml']: 'project:\n  endpoint: https://from-yaml.org',
  });

  await deployHandler(
    { ...options, endpoint: 'https://from-cli.org' } as any,
    logger,
    mockDeploy,
    async (args: any) => {
      t.is(args.endpoint, 'https://from-cli.org');
    }
  );
});

test.serial(
  'openfn.yaml endpoint preferred over config.json endpoint',
  async (t) => {
    mockfs({
      ['./config.json']: `{"apiKey": "123", "endpoint": "https://from-config.org"}`,
      ['./project.yaml']: `{"apiKey": "123"}`,
      ['./openfn.yaml']: 'project:\n  endpoint: https://from-yaml.org',
    });

    await deployHandler(options, logger, mockDeploy, async (args: any) => {
      t.is(args.endpoint, 'https://from-yaml.org');
    });
  }
);

test.serial('CLI apiKey preferred over config.json apiKey', async (t) => {
  mockfs({
    ['./config.json']: `{"apiKey": "from-config"}`,
    ['./project.yaml']: `{"apiKey": "from-config"}`,
    ['./openfn.yaml']: 'project:\n  endpoint: https://from-yaml.org',
  });

  await deployHandler(
    { ...options, apiKey: 'from-cli' } as any,
    logger,
    mockDeploy,
    async (args: any) => {
      t.is(args.apiKey, 'from-cli');
    }
  );
});

test.serial('catches DeployErrors', async (t) => {
  const origExitCode = process.exitCode;

  await deployHandler(options, logger, () =>
    Promise.reject(new DeployError('foo bar', 'STATE_ERROR'))
  );

  t.is(process.exitCode, 10);
  process.exitCode = origExitCode;
});

// maybeConvertV2spec

const v1Yaml = `id: '1234'
name: My Project
workflows:
  my-workflow:
    id: job-1
    name: My Workflow
    jobs:
      transform-data:
        id: job-1
        name: Transform data
        body: 'fn(s => s)'
        adaptor: '@openfn/language-common@latest'
        project_credential_id: null
        keychain_credential_id: null
    triggers:
      webhook:
        id: trig-1
        type: webhook
        enabled: true
    edges:
      trigger->transform-data:
        id: edge-1
        enabled: true
        source_trigger_id: trig-1
        target_job_id: job-1
project_credentials: []
`;

const v2Yaml = `id: my-project
name: My Project
schema_version: '4.0'
workflows:
  - id: my-workflow
    name: My Workflow
    start: webhook
    steps:
      - id: webhook
        type: webhook
        enabled: true
        next:
          transform-data: {}
      - id: transform-data
        name: Transform data
        expression: 'fn(s => s)'
        adaptor: '@openfn/language-common@latest'
`;

test('maybeConvertV2spec: returns v1 yaml unchanged', async (t) => {
  const result = await maybeConvertV2spec(v1Yaml);
  t.is(result, v1Yaml);
});

test('maybeConvertV2spec: converts v2 (schema_version) to v1', async (t) => {
  const result = await maybeConvertV2spec(v2Yaml);
  const json = yamlToJson(result) as any;

  // v1 has workflows as a keyed object
  t.is(typeof json.workflows, 'object');
  t.false(Array.isArray(json.workflows));

  // v1 uses jobs, not steps
  const workflow = Object.values(json.workflows)[0] as any;
  t.truthy(workflow.jobs);
  t.falsy(workflow.steps);
  t.truthy(workflow.triggers);

  // no v2 marker
  t.falsy(json.schema_version);
});

test('maybeConvertV2spec: converted edges use key references, not UUIDs', async (t) => {
  const result = await maybeConvertV2spec(v2Yaml);
  const json = yamlToJson(result) as any;

  const workflow = Object.values(json.workflows)[0] as any;
  const edge = Object.values(workflow.edges)[0] as any;

  // edge must use spec format (key references) so mergeSpecIntoState can resolve them
  t.truthy(edge.source_trigger);
  t.truthy(edge.target_job);
  t.falsy(edge.source_trigger_id);
  t.falsy(edge.target_job_id);

  // source_trigger must match a trigger key; target_job must match a job key
  t.truthy(workflow.triggers[edge.source_trigger]);
  t.truthy(workflow.jobs[edge.target_job]);
});

test('maybeConvertV2spec: converts legacy v2 (cli.version: 2) to v1', async (t) => {
  const legacyV2Yaml = `id: my-project
name: My Project
cli:
  version: 2
workflows:
  - id: my-workflow
    name: My Workflow
    start: webhook
    steps:
      - id: webhook
        type: webhook
        enabled: true
`;
  const result = await maybeConvertV2spec(legacyV2Yaml);
  const json = yamlToJson(result) as any;

  t.is(typeof json.workflows, 'object');
  t.false(Array.isArray(json.workflows));
});
