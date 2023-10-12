import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import autoinstall, { identifyAdaptors } from '../../src/api/autoinstall';
import { EngineAPI, ExecutionContext, WorkflowState } from '../../src/types';

type PackageJson = {
  name: string;
  [x: string]: any;
};

const mockIsInstalled = (pkg: PackageJson) => async (specifier: string) => {
  const alias = specifier.split('@').join('_');
  return pkg.dependencies.hasOwnProperty(alias);
};

const mockHandleInstall = async (specifier: string): Promise<void> =>
  new Promise<void>((r) => r()).then();

const logger = createMockLogger();

const createContext = (autoinstallOpts?, jobs?: any[]) =>
  ({
    logger,
    state: {
      plan: {
        jobs: jobs || [{ adaptor: 'x@1.0.0' }],
      },
    },
    options: {
      repoDir: '.',
      autoinstall: autoinstallOpts || {
        handleInstall: mockHandleInstall,
        handleIsInstalled: mockIsInstalled,
      },
    },
  } as unknown as ExecutionContext);

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

  const autoinstallOpts = {
    handleInstall: mockInstall,
    handleIsInstalled: mockIsInstalled,
  };
  const context = createContext(autoinstallOpts);

  await autoinstall(context);

  t.true(didCallIsInstalled);
  t.true(didCallInstall);
});

test.serial(
  'autoinstall: only call install once if there are two concurrent install requests',
  async (t) => {
    let callCount = 0;

    const mockInstall = () =>
      new Promise<void>((resolve) => {
        callCount++;
        setTimeout(() => resolve(), 20);
      });

    const options = {
      skipRepoValidation: true,
      handleInstall: mockInstall,
      handleIsInstalled: async () => false,
    };

    const context = createContext(options);

    await Promise.all([autoinstall(context), autoinstall(context)]);

    t.is(callCount, 1);
  }
);

test.serial('autoinstall: return a map to modules', async (t) => {
  const jobs = [
    {
      adaptor: 'common@1.0.0',
    },
    {
      adaptor: 'http@1.0.0',
    },
  ];

  const context = createContext(null, jobs);
  context.options = {
    repoDir: 'a/b/c',
    autoinstall: {
      skipRepoValidation: true,
      handleInstall: async () => {},
      handleIsInstalled: async () => false,
    },
  };

  const result = await autoinstall(context);

  t.deepEqual(result, {
    common: { path: 'a/b/c/node_modules/common_1.0.0' },
    http: { path: 'a/b/c/node_modules/http_1.0.0' },
  });
});
