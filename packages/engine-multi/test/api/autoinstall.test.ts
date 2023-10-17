import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import autoinstall, { identifyAdaptors } from '../../src/api/autoinstall';
import { AUTOINSTALL_COMPLETE } from '../../src/events';
import ExecutionContext from '../../src/classes/ExecutionContext';

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
  new ExecutionContext({
    state: {
      id: 'x',
      status: 'pending',
      options: {},
      plan: {
        jobs: jobs || [{ adaptor: 'x@1.0.0' }],
      },
    },
    logger,
    callWorker: () => {},
    options: {
      repoDir: 'tmp/repo',
      autoinstall: autoinstallOpts || {
        handleInstall: mockHandleInstall,
        handleIsInstalled: mockIsInstalled,
      },
    },
  });

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

  const autoinstallOpts = {
    skipRepoValidation: true,
    handleInstall: async () => {},
    handleIsInstalled: async () => false,
  };
  const context = createContext(autoinstallOpts, jobs);

  const result = await autoinstall(context);

  t.deepEqual(result, {
    common: { path: 'tmp/repo/node_modules/common_1.0.0' },
    http: { path: 'tmp/repo/node_modules/http_1.0.0' },
  });
});

test.serial('autoinstall: emit an event on completion', async (t) => {
  let event;
  const jobs = [
    {
      adaptor: 'common@1.0.0',
    },
  ];

  const autoinstallOpts = {
    skipRepoValidation: true,
    handleInstall: async () => new Promise((done) => setTimeout(done, 50)),
    handleIsInstalled: async () => false,
  };
  const context = createContext(autoinstallOpts, jobs);

  context.on(AUTOINSTALL_COMPLETE, (evt) => {
    event = evt;
  });

  await autoinstall(context);

  t.truthy(event);
  t.is(event.module, 'common');
  t.is(event.version, '1.0.0');
  t.assert(event.duration >= 50);
});

test.todo('autoinstall: emit on error');
