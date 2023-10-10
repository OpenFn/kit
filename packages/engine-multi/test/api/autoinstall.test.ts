import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import autoinstall, { identifyAdaptors } from '../../src/api/autoinstall';
import { EngineAPI, WorkflowState } from '../../src/types';

type PackageJson = {
  name: string;
  [x: string]: any;
};

const mockIsInstalled = (pkg: PackageJson) => async (specifier: string) => {
  const alias = specifier.split('@').join('_');
  return pkg.dependencies.hasOwnProperty(alias);
};

// TODO should this write to package json?
// I don't think there's any need
const mockHandleInstall = async (specifier: string): Promise<void> =>
  new Promise<void>((r) => r()).then();

const mockLogger = createMockLogger();

const api = {
  logger: mockLogger,
} as unknown as EngineAPI;

test('mock is installed: should be installed', async (t) => {
  const isInstalled = mockIsInstalled({
    name: 'repo',
    dependencies: {
      'x_1.0.0': 'path',
    },
  });

  const result = await isInstalled('x@1.0.0');
  t.true(result);
});

test('mock is installed: should not be installed', async (t) => {
  const isInstalled = mockIsInstalled({
    name: 'repo',
    dependencies: {
      'x_1.0.0': 'path',
    },
  });

  const result = await isInstalled('x@1.0.1');
  t.false(result);
});

test('mock install: should return async', async (t) => {
  await mockHandleInstall('x@1.0.0');
  t.true(true);
});

test('identifyAdaptors: pick out adaptors and remove duplicates', (t) => {
  const plan = {
    jobs: [
      {
        adaptor: 'common@1.0.0',
      },
      {
        adaptor: 'common@1.0.0',
      },
      {
        adaptor: 'common@1.0.1',
      },
    ],
  };
  const adaptors = identifyAdaptors(plan);
  t.true(adaptors.size === 2);
  t.true(adaptors.has('common@1.0.0'));
  t.true(adaptors.has('common@1.0.1'));
});

// This doesn't do anything except check that the mocks are installed
test.serial('autoinstall: should call both mock functions', async (t) => {
  let didCallIsInstalled = false;
  let didCallInstall = true;

  const mockIsInstalled = async () => {
    didCallIsInstalled = true;
    return false;
  };
  const mockInstall = async () => {
    didCallInstall = true;
    return;
  };

  const state = {
    plan: {
      jobs: [{ adaptor: 'x@1.0.0' }],
    },
  } as WorkflowState;

  const options = {
    handleInstall: mockInstall,
    handleIsInstalled: mockIsInstalled,
  };

  await autoinstall(api, state, options);

  t.true(didCallIsInstalled);
  t.true(didCallInstall);
});

test.serial(
  'autoinstall: only call install once if there are two concurrent install requests',
  async (t) => {
    let callCount = 0;

    const mockInstall = (specififer: string) =>
      new Promise<void>((resolve) => {
        callCount++;
        setTimeout(() => resolve(), 20);
      });

    const options = {
      handleInstall: mockInstall,
      handleIsInstalled: async () => false,
    };

    const state = {
      plan: {
        jobs: [{ adaptor: 'z@1.0.0' }],
      },
    } as WorkflowState;

    await Promise.all([
      autoinstall(api, state, options),
      autoinstall(api, state, options),
    ]);

    t.is(callCount, 1);
  }
);

test.serial('autoinstall: return a map to modules', async (t) => {
  const state = {
    plan: {
      // Note that we have difficulty now if a workflow imports two versions of the same adaptor
      jobs: [
        {
          adaptor: 'common@1.0.0',
        },
        {
          adaptor: 'http@1.0.0',
        },
      ],
    },
  } as WorkflowState;

  const options = {
    repoDir: 'a/b/c',
    skipRepoValidation: true,
    handleInstall: async () => true,
    handleIsInstalled: async () => false,
  };

  const result = await autoinstall(api, state, options);

  t.deepEqual(result, {
    common: { path: 'a/b/c/node_modules/common_1.0.0' },
    http: { path: 'a/b/c/node_modules/http_1.0.0' },
  });
});
